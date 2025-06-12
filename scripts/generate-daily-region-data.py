import os
import json
import random
import argparse
import requests
from dotenv import load_dotenv

def main():
    # Load API key from .env
    load_dotenv()
    api_key = os.getenv('EBIRD_API_KEY')
    if not api_key:
        raise ValueError("EBIRD_API_KEY not found in .env")

    # Parse CLI arguments
    parser = argparse.ArgumentParser(description='Fetch recent eBird observations for a random subregion.')
    parser.add_argument('subregions_file', help='Path to the subregions JSON file')
    parser.add_argument('output_file', help='Path to save the output JSON file')
    args = parser.parse_args()

    # Infer top-level region from filename
    region_prefix = os.path.basename(args.subregions_file).split('-')[0].lower()

    # Load subregions
    with open(args.subregions_file, 'r') as f:
        subregions = json.load(f)

    if not subregions:
        raise ValueError("Subregions list is empty.")

    # Pick a random subregion
    selected = random.choice(subregions)
    region_code = selected['code']
    subregion_name = selected['name']

    print(f"Selected subregion: {subregion_name} ({region_code})")

    # Query eBird API
    url = f'https://api.ebird.org/v2/data/obs/{region_code}/recent'
    headers = {'X-eBirdApiToken': api_key}
    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise RuntimeError(f"Failed to fetch data from eBird API: {response.status_code} {response.text}")

    observations = response.json()

    # Extract unique species codes
    unique_ids = sorted({obs['speciesCode'] for obs in observations})

    # Build output structure
    output = {
        region_prefix: {
            subregion_name: [
                {'id': species_id} for species_id in unique_ids
            ]
        }
    }

    # Save to output file
    with open(args.output_file, 'w') as out_f:
        json.dump(output, out_f, indent=2)

    print(f"Output written to {args.output_file}")

if __name__ == '__main__':
    main()
