# Supabase Setup Guide

This guide will walk you through setting up Supabase for real-time multi-device synchronization in your Traitors and Allies game.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign in"
3. Create a new account or sign in with GitHub
4. Click "New Project"
5. Fill in the details:
   - **Project name**: Traitors and Allies (or your choice)
   - **Database password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your location
   - **Pricing plan**: Free tier is sufficient for most use cases
6. Click "Create new project" and wait ~2 minutes for provisioning

## Step 2: Run the Database Schema

1. In your Supabase project dashboard, click on the **SQL Editor** in the left sidebar
2. Click "New Query"
3. Open the `supabase-schema.sql` file from this repository
4. Copy ALL the contents of that file
5. Paste into the SQL Editor
6. Click "Run" (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned" - this is correct!

This creates:
- `games` table (stores game state with host tracking)
- `players` table (stores player information)
- Indexes for performance
- Row Level Security (RLS) policies
- Realtime subscriptions
- Auto-cleanup function

**Note for Existing Users:** The schema file includes a migration that automatically adds the `host_name` column to the `games` table if it doesn't exist. Safe to run multiple times!

## Step 3: Get Your API Credentials

1. In your Supabase project, click on **Settings** (gear icon) in the left sidebar
2. Click on **API** under Project Settings
3. Find these two values:
   - **Project URL**: Something like `https://xxxxx.supabase.co`
   - **Project API keys > anon public**: A long string starting with `eyJ...`

## Step 4: Add Credentials to Your App

1. Open `index.html` in your code editor
2. Find these lines near the top of the `<script>` section (around line 976):
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
3. Replace `YOUR_SUPABASE_URL` with your Project URL
4. Replace `YOUR_SUPABASE_ANON_KEY` with your anon public key

Example:
```javascript
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

## Step 5: Enable Realtime (If Not Already Enabled)

1. In Supabase, go to **Database** > **Replication**
2. Find the `games` and `players` tables
3. Make sure the toggle switch is **ON** (green) for both tables
4. If you made changes, wait ~30 seconds for replication to start

## Step 6: Test Your Setup

1. Open `index.html` in your browser
2. Open the browser console (F12 or Cmd+Option+I)
3. Create a new game
4. You should see console logs like:
   - "Game created in DB: [uuid]"
   - "Subscribed to game updates"
   - "Subscribed to player updates"
5. If you see these, congratulations! Supabase is working!

## Step 7: Test Multi-Device Sync

1. Create a game on one device/browser tab
2. Copy the URL with the room code (e.g., `https://yoursite.com?room=ABCD`)
3. Open that URL in another browser tab or device
4. You should see:
   - The waiting room
   - The same room code
   - The ability to join the game
5. Join with a name - the first device should see the new player appear automatically!

## Security Features Implemented

✅ **Row Level Security (RLS)**: Prevents unauthorized data access
✅ **Public read/write**: Anyone can view games and join (appropriate for public game)
✅ **Time-based expiration**: Games auto-delete after 4 hours
✅ **HTTPS only**: All data transmitted securely
✅ **No sensitive data**: Player roles only sent to that specific player

## Performance Optimizations

✅ **Indexed queries**: Fast lookups by room code and game ID
✅ **Connection reuse**: Single Supabase client shared across app
✅ **Selective subscriptions**: Only subscribe to your game's updates
✅ **JSONB storage**: Flexible data structure without excessive columns
✅ **Auto-cleanup**: Prevents database bloat from old games

## Troubleshooting

### "Supabase not configured - running in offline mode"
- Check that you've replaced `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with actual values
- Make sure you're not using placeholder text

### "Failed to create game in database"
- Check browser console for specific error
- Verify your API key is correct
- Check that RLS policies were created (rerun supabase-schema.sql)

### Players not syncing across devices
- Check that Realtime is enabled for both tables (Database > Replication)
- Open browser console on both devices - look for "Subscribed to..." messages
- Wait 30 seconds after enabling Realtime

### "Game with room code not found"
- The game may have expired (4 hour limit)
- Check that the room code was entered correctly
- Verify the game was actually created in Supabase (check Database > Table Editor)

## Database Management

### View Your Data
1. Go to **Database** > **Table Editor**
2. Click on `games` or `players` to see all records
3. You can manually edit/delete records here if needed

### Clean Up Old Games Manually
Run this query in SQL Editor:
```sql
SELECT cleanup_expired_games();
```

### Monitor Usage
1. Go to **Settings** > **Usage**
2. Free tier includes:
   - 500 MB database
   - 1 GB bandwidth
   - 2 GB file storage
   - 50,000 monthly active users

For a party game, you'll likely never hit these limits!

## Next Steps

Once Supabase is set up and working:
1. Deploy your updated `index.html` to Vercel
2. Share the URL with the room code to let others join
3. Enjoy real-time multiplayer Traitors and Allies!

## Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord Community](https://discord.supabase.com)
- Check browser console for error messages
