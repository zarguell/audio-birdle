#!/usr/bin/env python3
"""
Bird Data JSON Generator

This script processes taxonomy and URL data files to create a JSON file
with bird information organized by region.

Usage:
    python bird_json_generator.py --region US --taxonomy taxonomy.json --urls urls.json --output birds.json
"""

import json
import argparse
import os
from typing import Dict, List, Any
from collections import defaultdict


def load_json_file(filepath: str) -> List[Dict[str, Any]]:
    """Load and return JSON data from a file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{filepath}' not found.")
        exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in file '{filepath}': {e}")
        exit(1)


def load_existing_output(filepath: str) -> Dict[str, Any]:
    """Load existing output file if it exists, otherwise return empty structure."""
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            print(f"Warning: Could not read existing file '{filepath}', starting fresh.")
    return {}


def create_bird_id(species_code: str) -> str:
    """Create a bird ID from species code (first 4 characters)."""
    return species_code[:4] if len(species_code) >= 4 else species_code


def group_urls_by_code(urls_data: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """Group audio URLs by species code."""
    url_groups = defaultdict(list)
    
    for entry in urls_data:
        code = entry.get('code', '')
        audio_url = entry.get('audio Url', '')
        
        if code and audio_url:
            url_groups[code].append(audio_url)
    
    return dict(url_groups)


def process_taxonomy_data(taxonomy_data: List[Dict[str, Any]], 
                         url_groups: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    """Process taxonomy data and match with audio URLs."""
    birds = []
    
    for bird in taxonomy_data:
        species_code = bird.get('speciesCode', '')
        com_name = bird.get('comName', '')
        sci_name = bird.get('sciName', '')
        
        # Skip if essential data is missing
        if not all([species_code, com_name, sci_name]):
            continue
        
        # Get audio URLs for this species
        audio_urls = url_groups.get(species_code, [])
        
        # Only include birds that have audio URLs
        if audio_urls:
            bird_entry = {
                "id": create_bird_id(species_code),
                "name": com_name,
                "scientificName": sci_name,
                "audioUrl": audio_urls
            }
            birds.append(bird_entry)
    
    return birds


def save_json_file(data: Dict[str, Any], filepath: str) -> None:
    """Save data to JSON file with proper formatting."""
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Successfully saved data to '{filepath}'")
    except IOError as e:
        print(f"Error: Could not write to file '{filepath}': {e}")
        exit(1)


def main():
    parser = argparse.ArgumentParser(description='Generate bird data JSON from taxonomy and URL files')
    parser.add_argument('--region', required=True, help='Region code (e.g., US, EU)')
    parser.add_argument('--taxonomy', required=True, help='Path to taxonomy JSON file')
    parser.add_argument('--urls', required=True, help='Path to URLs JSON file')
    parser.add_argument('--output', required=True, help='Output JSON file path')
    
    args = parser.parse_args()
    
    # Load input files
    print(f"Loading taxonomy data from '{args.taxonomy}'...")
    taxonomy_data = load_json_file(args.taxonomy)
    
    print(f"Loading URLs data from '{args.urls}'...")
    urls_data = load_json_file(args.urls)
    
    # Load existing output file if it exists
    print(f"Checking for existing output file '{args.output}'...")
    output_data = load_existing_output(args.output)
    
    # Group URLs by species code
    print("Processing URL data...")
    url_groups = group_urls_by_code(urls_data)
    
    # Process taxonomy data and match with URLs
    print("Processing taxonomy data and matching with audio URLs...")
    birds = process_taxonomy_data(taxonomy_data, url_groups)
    
    # Update the output data for the specified region
    region_key = args.region.lower()
    output_data[region_key] = birds
    
    print(f"Found {len(birds)} birds with audio URLs for region '{args.region}'")
    
    # Save the updated data
    save_json_file(output_data, args.output)
    
    print("Processing complete!")


if __name__ == "__main__":
    main()