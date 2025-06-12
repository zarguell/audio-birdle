#!/usr/bin/env python3
"""
Daily Bird Generator Script

Generates daily bird answers for each region, ensuring no repeats within X days.
Optionally filters by subregion (e.g., US states) if subregions file is provided.

Usage: python generate_daily_birds.py [--days X] [--date YYYY-MM-DD] [--subregions subregions.json]
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

def get_subregion_for_date(subregions_data, region_id, target_date):
    """
    Select a subregion for the given date and region.
    This could be random or based on some deterministic logic.
    For now, using a simple hash-based selection for consistency.
    """
    region_subregions = subregions_data.get(region_id, {})
    if not region_subregions:
        return None, []
    
    # Get list of available subregions
    subregion_names = list(region_subregions.keys())
    if not subregion_names:
        return None, []
    
    # Use date as seed for consistent daily selection
    date_seed = target_date.strftime('%Y-%m-%d') + region_id
    random.seed(hash(date_seed))
    selected_subregion = random.choice(subregion_names)
    
    # Reset random seed to system time for other randomness
    random.seed()
    
    # Get bird IDs for this subregion
    subregion_bird_ids = set()
    for bird_entry in region_subregions[selected_subregion]:
        subregion_bird_ids.add(bird_entry['id'])
    
    return selected_subregion, subregion_bird_ids

def filter_birds_by_subregion(birds, subregion_bird_ids):
    """Filter birds list to only include birds from the subregion"""
    if not subregion_bird_ids:
        return birds
    
    filtered_birds = [bird for bird in birds if bird['id'] in subregion_bird_ids]
    return filtered_birds

def select_bird_for_region(birds, recent_answers, subregion_bird_ids=None):
    """Select a random bird that hasn't been used recently, optionally filtered by subregion"""
    # First filter by subregion if provided
    if subregion_bird_ids:
        birds = filter_birds_by_subregion(birds, subregion_bird_ids)
        if not birds:
            print("Warning: No birds available in subregion. Using all region birds.")
            # Fall back to all birds in region if subregion filtering yields no results
            return None
    
    # Then filter by recent answers
    available_birds = [bird for bird in birds if bird['id'] not in recent_answers]
    
    if not available_birds:
        print("Warning: No birds available that haven't been used recently. Using all birds.")
        available_birds = birds
    
    if not available_birds:
        return None
        
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
    parser.add_argument('--subregions', type=str,
                       help='Path to subregions JSON file for filtering birds by state/province')
    
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
    
    # Load subregions data if provided
    subregions_data = {}
    if args.subregions:
        subregions_path = Path(args.subregions)
        if subregions_path.exists():
            subregions_data = load_json_file(subregions_path)
            print(f"Loaded subregions data from {args.subregions}")
        else:
            print(f"Warning: Subregions file {args.subregions} not found, proceeding without subregion filtering")
    
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
        
        # Get subregion filtering if available
        selected_subregion = None
        subregion_bird_ids = set()
        
        if subregions_data:
            selected_subregion, subregion_bird_ids = get_subregion_for_date(
                subregions_data, region_id, target_date
            )
            
            if selected_subregion:
                print(f"Selected subregion: {selected_subregion}")
                print(f"Subregion has {len(subregion_bird_ids)} bird species")
                
                # Filter region birds by subregion
                subregion_filtered_birds = filter_birds_by_subregion(region_birds, subregion_bird_ids)
                print(f"After subregion filtering: {len(subregion_filtered_birds)} birds available")
            else:
                print("No subregion data available for this region")
        
        # Get recent answers for this region
        recent_answers = get_recent_answers(history, region_id, args.days, target_date)
        print(f"Recent answers to avoid: {recent_answers}")
        
        # Select a bird
        selected_bird = select_bird_for_region(
            region_birds, recent_answers, 
            subregion_bird_ids if selected_subregion else None
        )
        
        if not selected_bird:
            print(f"Error: Could not select a bird for region {region_id}")
            continue
            
        bird_hash = hash_bird_id(selected_bird['id'])
        
        print(f"Selected: {selected_bird['name']} ({selected_bird['id']}) -> {bird_hash}")
        
        # Add to daily data
        daily_entry = {
            'date': target_date_str,
            'region': region_id,
            'answerHash': bird_hash
        }
        
        # Add subregion info if available
        if selected_subregion:
            daily_entry['subregion'] = selected_subregion
        
        new_daily.append(daily_entry)
        
        # Update history for future runs
        if region_id not in history:
            history[region_id] = []
        
        # Add today's selection to history (for future reference)
        history_entry = {
            'date': target_date_str,
            'id': selected_bird['id'],
            'name': selected_bird['name']
        }
        
        if selected_subregion:
            history_entry['subregion'] = selected_subregion
            
        history[region_id].append(history_entry)
        
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
        subregion_info = f" (subregion: {entry['subregion']})" if 'subregion' in entry else ""
        print(f"  {entry['region']}: {entry['answerHash']} ({entry['date']}){subregion_info}")

if __name__ == '__main__':
    main()