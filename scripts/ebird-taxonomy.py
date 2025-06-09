import os
from dotenv import load_dotenv
import requests
import argparse

def fetch_taxonomy(version, category='all', fmt='json', species=None):
    # Get the API key from the environment variable
    load_dotenv()
    api_key = os.getenv('EBIRD_API_KEY')
    if not api_key:
        raise ValueError("API key not found. Please set the EBIRD_API_KEY environment variable.")

    # Define the URL and headers
    url = 'https://api.ebird.org/v2/ref/taxonomy/ebird'
    headers = {
        'X-eBirdApiToken': api_key
    }
    
    # Prepare parameters, only include if specified
    params = {}
    
    if version:
        params['version'] = version
    if category:
        params['cat'] = category
    if fmt:
        params['fmt'] = fmt
    if species:
        params['species'] = species

    # Make the request
    response = requests.get(url, headers=headers, params=params)

    # Check for a successful response
    if response.status_code == 200:
        return response.content  # Return raw content for saving
    else:
        response.raise_for_status()

def save_to_file(data, output_file):
    with open(output_file, 'wb') as f:
        f.write(data)
    print(f"Data saved to {output_file}")

if __name__ == "__main__":
    # Set up command-line argument parsing
    parser = argparse.ArgumentParser(description='Fetch eBird taxonomy data.')
    parser.add_argument('--species', help='Species code to fetch records for. Omit to fetch all species.')
    parser.add_argument('--version', help='Taxonomy version to fetch.')
    parser.add_argument('--category', help='Taxonomic category to filter by.')
    parser.add_argument('--fmt', choices=['csv', 'json'], help='Format of the response.')
    parser.add_argument('--locale', default='en', help='Locale for common names.')
    parser.add_argument('--output', help='File to save the output data.')

    args = parser.parse_args()

    # Fetch the taxonomy data
    try:
        data = fetch_taxonomy(args.version, args.category, args.fmt, args.species)
        
        # If an output file is specified, save the data
        if args.output:
            save_to_file(data, args.output)
        else:
            print(data.decode('utf-8'))  # Print the data if no output file is specified
    except Exception as e:
        print(f"Error: {e}")
