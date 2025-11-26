-- Among Us IRL - Supabase Database Schema
-- Run this script in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code TEXT UNIQUE NOT NULL,
    host_name TEXT,
    stage TEXT NOT NULL DEFAULT 'waiting',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    meetings_used INTEGER DEFAULT 0,
    game_ended BOOLEAN DEFAULT false,
    winner TEXT,
    meeting_type TEXT,
    meeting_caller TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '4 hours')
);

-- Create players table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    ready BOOLEAN DEFAULT true,
    alive BOOLEAN DEFAULT true,
    tasks JSONB DEFAULT '[]'::jsonb,
    tasks_completed INTEGER DEFAULT 0,
    voted_for TEXT,
    emergency_meetings_used INTEGER DEFAULT 0,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, name)
);

-- Create indexes for performance
CREATE INDEX idx_games_room_code ON games(room_code);
CREATE INDEX idx_games_expires_at ON games(expires_at);
CREATE INDEX idx_players_game_id ON players(game_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for games table
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to cleanup expired games
CREATE OR REPLACE FUNCTION cleanup_expired_games()
RETURNS void AS $$
BEGIN
    DELETE FROM games WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games table
CREATE POLICY "Anyone can view games"
    ON games FOR SELECT
    USING (true);

CREATE POLICY "Anyone can create games"
    ON games FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Can update recent games"
    ON games FOR UPDATE
    USING (created_at > NOW() - INTERVAL '4 hours');

-- RLS Policies for players table
CREATE POLICY "Anyone can view players"
    ON players FOR SELECT
    USING (true);

CREATE POLICY "Anyone can join games"
    ON players FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Players can update themselves"
    ON players FOR UPDATE
    USING (true);

CREATE POLICY "Players can leave games"
    ON players FOR DELETE
    USING (true);

-- Enable Realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE players;

-- Grant permissions
GRANT ALL ON games TO anon, authenticated;
GRANT ALL ON players TO anon, authenticated;

-- Migration: Add host_name column if it doesn't exist (for existing databases)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'games' AND column_name = 'host_name') THEN
        ALTER TABLE games ADD COLUMN host_name TEXT;
    END IF;
END $$;

-- ==================== PHASE 1: SYNCHRONIZATION IMPROVEMENTS ====================
-- Add dedicated columns for concurrent-write fields to eliminate race conditions

-- Add new columns for atomic updates
DO $$
BEGIN
    -- Add votes column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'games' AND column_name = 'votes') THEN
        ALTER TABLE games ADD COLUMN votes JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add meeting_ready column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'games' AND column_name = 'meeting_ready') THEN
        ALTER TABLE games ADD COLUMN meeting_ready JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add vote_results column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'games' AND column_name = 'vote_results') THEN
        ALTER TABLE games ADD COLUMN vote_results JSONB;
    END IF;

    -- Add sequence_number column for ordering
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'games' AND column_name = 'sequence_number') THEN
        ALTER TABLE games ADD COLUMN sequence_number BIGSERIAL;
    END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_games_votes ON games USING GIN (votes);
CREATE INDEX IF NOT EXISTS idx_games_meeting_ready ON games USING GIN (meeting_ready);
CREATE INDEX IF NOT EXISTS idx_games_sequence ON games(sequence_number);

-- Migrate existing data from settings column
UPDATE games SET
  votes = COALESCE(settings->'votes', '{}'::jsonb),
  meeting_ready = COALESCE(settings->'meetingReady', '{}'::jsonb),
  vote_results = settings->'voteResults'
WHERE settings IS NOT NULL AND (votes IS NULL OR meeting_ready IS NULL);

-- ==================== SEQUENCE NUMBER AUTO-INCREMENT ====================
-- Trigger to increment sequence_number on every UPDATE to games table

CREATE OR REPLACE FUNCTION increment_sequence_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Use nextval to get next sequence value
  NEW.sequence_number = nextval(pg_get_serial_sequence('games', 'sequence_number'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS auto_increment_sequence ON games;
CREATE TRIGGER auto_increment_sequence
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION increment_sequence_number();

-- ==================== ATOMIC UPDATE FUNCTIONS ====================
-- These functions use row-level locking to prevent race conditions

-- Atomic vote submission with row locking
CREATE OR REPLACE FUNCTION submit_vote(
  game_uuid UUID,
  player_name TEXT,
  vote_value TEXT
)
RETURNS JSONB AS $$
DECLARE
  updated_votes JSONB;
BEGIN
  -- Lock the row to prevent concurrent writes
  SELECT votes INTO updated_votes
  FROM games
  WHERE id = game_uuid
  FOR UPDATE;

  -- Merge the new vote
  updated_votes = updated_votes || jsonb_build_object(player_name, vote_value);

  -- Update with merged votes
  UPDATE games
  SET votes = updated_votes, updated_at = NOW()
  WHERE id = game_uuid;

  RETURN updated_votes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic meeting ready acknowledgment
CREATE OR REPLACE FUNCTION acknowledge_meeting(
  game_uuid UUID,
  player_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  updated_ready JSONB;
BEGIN
  -- Lock the row to prevent concurrent writes
  SELECT meeting_ready INTO updated_ready
  FROM games
  WHERE id = game_uuid
  FOR UPDATE;

  -- Merge the new ready status
  updated_ready = updated_ready || jsonb_build_object(player_name, true);

  -- Update with merged ready status
  UPDATE games
  SET meeting_ready = updated_ready, updated_at = NOW()
  WHERE id = game_uuid;

  RETURN updated_ready;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear meeting state (called when resuming game)
CREATE OR REPLACE FUNCTION clear_meeting_state(game_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE games
  SET
    votes = '{}'::jsonb,
    meeting_ready = '{}'::jsonb,
    vote_results = NULL,
    updated_at = NOW()
  WHERE id = game_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Batch update players (for game start role assignment)
CREATE OR REPLACE FUNCTION batch_update_players(
  game_uuid UUID,
  player_updates JSONB
)
RETURNS VOID AS $$
DECLARE
  player_update JSONB;
BEGIN
  -- Loop through each player update
  FOR player_update IN SELECT * FROM jsonb_array_elements(player_updates)
  LOOP
    UPDATE players
    SET
      role = player_update->>'role',
      tasks = player_update->'tasks',
      alive = (player_update->>'alive')::boolean,
      tasks_completed = (player_update->>'tasks_completed')::integer
    WHERE game_id = game_uuid AND name = player_update->>'name';
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent joins during active game (trigger function)
CREATE OR REPLACE FUNCTION prevent_join_started_game()
RETURNS TRIGGER AS $$
DECLARE
  game_stage TEXT;
BEGIN
  -- Check the current stage of the game
  SELECT stage INTO game_stage FROM games WHERE id = NEW.game_id;

  -- Only allow joins during setup or waiting stages
  IF game_stage NOT IN ('waiting', 'setup') THEN
    RAISE EXCEPTION 'Cannot join - game already started';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent late joins
DROP TRIGGER IF EXISTS check_join_allowed ON players;
CREATE TRIGGER check_join_allowed
  BEFORE INSERT ON players
  FOR EACH ROW
  EXECUTE FUNCTION prevent_join_started_game();
