// Game data structure
const ROOMS_AND_TASKS = {
"Anywhere": [
"Power Down Protocol: Close your eyes, stand still, and count out loud for 30 seconds."
],
"Outside": [
"Stellar Navigation: Look at the sky for 20 seconds.",
"Suspicious Surveillance: Stand in front of a neighbor's house for 20 seconds.",
"House Boundary Scan: Touch all four outside corners of the house.",
"Prepare the Runway: Lay down and roll across the driveway.",
"Touch Grass: Remove your footwear and stand on the grass for 5 seconds.",
"Test Comms: Put your head in the mailbox for 15 seconds."
],
"Living Room": [
"Living Room Groove: Dance in the living room for 20 seconds.",
"Couch Compression Test: Sit on every seat cushion once.",
"Remote Frequency Calibration: Find the TV remote and press any button.",
"Light Sync: Turn a lamp off, then on again."
],
"Kitchen": [
"Heat Sensor Check: Open the oven/microwave door for 20 seconds, then close it.",
"Cold Storage Audit: Open the fridge and name three items out loud.",
"Utensil Sort: Use utensils to spell the word 'ALLY' and then return them.",
"Water Pressure Test: Run the sink for 3 seconds.",
"Nutrient Calibration: Touch 3 different types of food and name them out loud."
],
"Garage": [
"Navigation Calibration: Touch all 4 corners of the garage.",
"Tool Inventory Scan: Locate 3 different tools and name them out loud.",
"Vehicle Diagnostics: Place your hand on a car tire for 20 seconds."
],
"Bedrooms": [
"Sleep Reset: Lie face down on a bed for 20 seconds.",
"Meditation Moment: Assume a meditative pose and hold it for 20 seconds.",
"Initialization Routine: Do 1 pushup, 1 sit-up, and 1 jumping jack."
],
"Bathrooms": [
"Emergency Water Reset: Turn both faucets on and off.",
"Sit in a bathtub for 15 seconds."
],
"Closets": [
"Spend 10 seconds in three different closets. The door must be closed."
],
"Office": [
"Data Upload: Read a book in the office for 15 seconds."
],
"Other": [
"Put your head in the washing machine for 10 seconds.",
"Put your head in the dryer for 10 seconds."
]
};

/*
// This set of rooms and tasks is temporary until we can store different sets and users. 
const ROOMS_AND_TASKS = {
"Anywhere": [
"Power Down Protocol: Close your eyes, stand still, and count out loud for 30 seconds."
],
"Outside": [
"Stellar Navigation: Look at the sky for 20 seconds.",
"Suspicious Surveillance: Stand in front of someone else's car for 20 seconds.",
"House Boundary Scan: Touch all four outside corners of the church.",
"Clear the Way: Go up and down the stairs 3 times.",
"Touch Grass: Remove your footwear and stand on the grass for 5 seconds.",
"Vehicle Diagnostics: Place your hand on a car tire for 20 seconds."
],
"Cultural Hall": [
"Gymnasium Groove: Dance in the living room for 20 seconds.",
"Remote Frequency Calibration: Find the TV remote and press any button.",
"Light Sync: Turn each light switch in the room off, then on again."
],
"Kitchen": [
"Heat Sensor Check: Open the oven/microwave door for 20 seconds, then close it.",
"Cold Storage Audit: Open the fridge and name three items out loud.",
"Utensil Sort: Use utensils to spell the word 'ALLY' and then return them.",
"Water Pressure Test: Run the sink for 3 seconds.",
"Nutrient Calibration: Touch 3 different types of food and name them out loud."
],
"Foyer": [
"Couch Compression Test: Sit on every seat cushion once.",
"Navigation Calibration: Open each door in the entry way."
],
"Relief Society Room": [
"Musical Chairs: Set up and take down 5 different folding chairs",
"Meditation Moment: Assume a meditative pose and hold it for 20 seconds.",
"Initialization Routine: Do 1 pushup, 1 sit-up, and 1 jumping jack."
],
"Primary Room": [
"Musical Chairs: Set up and take down 5 different folding chairs",
"Meditation Moment: Assume a meditative pose and hold it for 20 seconds.",
"Initialization Routine: Do 1 pushup, 1 sit-up, and 1 jumping jack."
],
"Nursery": [
"Singing Time: Sing a nursery rhyme from start to finish.",
"Play Time: Play with a toy for 20 seconds."
]
};
*/

// Export for testing and module usage
export { ROOMS_AND_TASKS };
