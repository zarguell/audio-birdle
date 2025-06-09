// Development script to generate daily.json entries
// This would be run by content creators to populate the daily.json file

import { generateDailyEntry, hashBirdId } from '../src/utils/DailyBirdUtils.js';

// Mock bird data - replace with your actual bird data structure
const mockBirds = {
  us: [
    { id: 'robin', name: 'American Robin' },
    { id: 'cardinal', name: 'Northern Cardinal' },
    { id: 'bluejay', name: 'Blue Jay' },
    { id: 'sparrow', name: 'House Sparrow' }
  ],
  uk: [
    { id: 'robin-eu', name: 'European Robin' },
    { id: 'blackbird', name: 'Common Blackbird' },
    { id: 'wren', name: 'Eurasian Wren' }
  ]
};

// Function to generate entries for multiple days
function generateDailyEntries(startDate, numDays, regions) {
  const entries = [];
  
  for (let i = 0; i < numDays; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    for (const region of regions) {
      const birds = mockBirds[region];
      if (birds && birds.length > 0) {
        // For demo purposes, cycle through birds. In production, you'd choose strategically
        const birdIndex = i % birds.length;
        const selectedBird = birds[birdIndex];
        
        const entry = generateDailyEntry(dateStr, region, selectedBird.id);
        entries.push(entry);
        
        console.log(`${dateStr} ${region}: ${selectedBird.name} (${selectedBird.id}) -> ${entry.answerHash}`);
      }
    }
  }
  
  return entries;
}

// Example usage
console.log('Generating daily entries...\n');

const startDate = '2025-06-08';
const numDays = 7;
const regions = ['us'];

const dailyEntries = generateDailyEntries(startDate, numDays, regions);

console.log('\nGenerated daily.json:');
console.log(JSON.stringify(dailyEntries, null, 2));

// Function to verify a hash matches a bird
function verifyBirdHash(birdId, expectedHash) {
  const actualHash = hashBirdId(birdId);
  const matches = actualHash === expectedHash.toLowerCase();
  console.log(`Bird "${birdId}" -> Hash: ${actualHash}, Expected: ${expectedHash}, Matches: ${matches}`);
  return matches;
}

// Example verification
console.log('\nHash verification examples:');
verifyBirdHash('robin', '84a91b3f'); // This should match if robin generates this hash
verifyBirdHash('cardinal', '84a91b3f'); // This should not match