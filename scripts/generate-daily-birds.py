#!/usr/bin/env python3
"""
Daily Bird Generator Script

Generates daily bird answers for each region, ensuring no repeats within X days.
Usage: python generate_daily_birds.py [--days X] [--date YYYY-MM-DD]
"""

import json
import argparse
import random
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Salt for hashing (must match JavaScript implementation)
SECRET_SALT = "birdle-salt-2025"

def hash_bird_id(bird_id):
    """
    Hash a bird ID with the secret salt using the same algorithm as JavaScript
    """
    combined = f"{bird_id}-{SECRET_SALT}"
    hash_value = 0
    
    for char in combined:
        char_code = ord(char)
        hash_value = ((hash_value << 5) - hash_value) + char_code
        # Convert to 32-bit signed integer
        hash_value = hash_value & 0xFFFFFFFF
        if hash_value >= 0x80000000:
            hash_value -= 0x100000000
    
    # Convert to hex and take first 8 characters
    hex_hash = format(hash_value & 0xFFFFFFFF, '08x')
    return hex_hash[:8]

def load_json_file(file_path):
    """Load JSON file with error handling"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: {file_path} not found, creating empty structure")
        return {} if 'history' in str(file_path) else []
    except json.JSONDecodeError as e:
        print(f"Error parsing {file_path}: {e}")
        sys.exit(1)

def save_json_file(file_path, data):
    """Save JSON file with proper formatting"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def get_recent_answers(history, region, days, current_date):
    """Get bird IDs that were answers in the last X days for a region"""
    recent_answers = set()
    cutoff_date = current_date - timedelta(days=days)
    
    region_history = history.get(region, [])
    for entry in region_history:
        entry_date = datetime.strptime(entry['date'], '%Y-%m-%d').date()
        if entry_date > cutoff_date:
            recent_answers.add(entry['id'])
    
    return recent_answers

def select_bird_for_region(birds, recent_answers):
    """Select a random bird that hasn't been used recently"""
    available_birds = [bird for bird in birds if bird['id'] not in recent_answers]
    
    if not available_birds:
        print("Warning: No birds available that haven't been used recently. Using all birds.")
        available_birds = birds
    
    return random.choice(available_birds)

def update_history(history, daily_data, current_date):
    """Update history with yesterday's answers from daily.json"""
    yesterday = current_date - timedelta(days=1)
    yesterday_str = yesterday.strftime('%Y-%m-%d')
    
    # Find yesterday's entries in daily_data
    for entry in daily_data:
        if entry['date'] == yesterday_str:
            region = entry['region']
            # We need to find the bird ID from the hash - this is a limitation
            # In practice, you might want to store the bird ID directly in daily.json
            # For now, we'll skip this step as we can't reverse the hash
            print(f"Note: Cannot reverse hash to update history for {region} on {yesterday_str}")
    
    return history

def main():
    parser = argparse.ArgumentParser(description='Generate daily bird answers')
    parser.add_argument('--days', type=int, default=7, 
                       help='Number of days to avoid repeating birds (default: 7)')
    parser.add_argument('--date', type=str, 
                       help='Date to generate for (YYYY-MM-DD, default: today)')
    
    args = parser.parse_args()
    
    # Set up paths
    base_path = Path('./public/data')
    regions_path = base_path / 'regions.json'
    birds_path = base_path / 'birds.json'
    history_path = base_path / 'history.json'
    daily_path = base_path / 'daily.json'
    
    # Parse target date
    if args.date:
        try:
            target_date = datetime.strptime(args.date, '%Y-%m-%d').date()
        except ValueError:
            print("Error: Date must be in YYYY-MM-DD format")
            sys.exit(1)
    else:
        target_date = datetime.now().date()
    
    target_date_str = target_date.strftime('%Y-%m-%d')
    
    print(f"Generating daily birds for {target_date_str}")
    print(f"Avoiding repeats within {args.days} days")
    
    # Load data files
    regions = load_json_file(regions_path)
    birds_data = load_json_file(birds_path)
    history = load_json_file(history_path)
    current_daily = load_json_file(daily_path)
    
    # Update history with yesterday's data (if we can determine the bird IDs)
    # Note: This is simplified - in practice you might want to store bird IDs in daily.json
    history = update_history(history, current_daily, target_date)
    
    # Generate new daily answers
    new_daily = []
    
    for region in regions:
        region_id = region['id']
        region_name = region['name']
        
        print(f"\nProcessing region: {region_name} ({region_id})")
        
        # Get birds for this region
        region_birds = birds_data.get(region_id, [])
        if not region_birds:
            print(f"Warning: No birds found for region {region_id}")
            continue
            
        print(f"Found {len(region_birds)} birds in {region_name}")
        
        # Get recent answers for this region
        recent_answers = get_recent_answers(history, region_id, args.days, target_date)
        print(f"Recent answers to avoid: {recent_answers}")
        
        # Select a bird
        selected_bird = select_bird_for_region(region_birds, recent_answers)
        bird_hash = hash_bird_id(selected_bird['id'])
        
        print(f"Selected: {selected_bird['name']} ({selected_bird['id']}) -> {bird_hash}")
        
        # Add to daily data
        new_daily.append({
            'date': target_date_str,
            'region': region_id,
            'answerHash': bird_hash
        })
        
        # Update history for future runs
        if region_id not in history:
            history[region_id] = []
        
        # Add today's selection to history (for future reference)
        history[region_id].append({
            'date': target_date_str,
            'id': selected_bird['id'],
            'name': selected_bird['name']
        })
        
        # Keep only recent history (optional cleanup)
        cutoff_date = target_date - timedelta(days=args.days * 2)  # Keep double the avoidance period
        history[region_id] = [
            entry for entry in history[region_id]
            if datetime.strptime(entry['date'], '%Y-%m-%d').date() > cutoff_date
        ]
    
    # Save updated files
    save_json_file(daily_path, new_daily)
    save_json_file(history_path, history)
    
    print(f"\n✓ Generated daily.json with {len(new_daily)} entries")
    print(f"✓ Updated history.json")
    print(f"✓ Files saved to {base_path}")
    
    # Display summary
    print("\nGenerated entries:")
    for entry in new_daily:
        print(f"  {entry['region']}: {entry['answerHash']} ({entry['date']})")

if __name__ == '__main__':
    main()