import os
from dotenv import load_dotenv
import requests
import argparse

def fetch_region(region):
    # Get the API key from the environment variable
    load_dotenv()
    api_key = os.getenv('EBIRD_API_KEY')
    if not api_key:
        raise ValueError("API key not found. Please set the EBIRD_API_KEY environment variable.")

    # Define the URL and headers
    url = 'https://api.ebird.org/v2/ref/region/list/subnational1/'
    headers = {
        'X-eBirdApiToken': api_key
    }

    # Make the request
    response = requests.get(url + region, headers=headers)

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
    parser = argparse.ArgumentParser(description='Fetch eBird subregions data for a specific country region.')
    parser.add_argument('--region', required=True, help='Any location, USFWS region, subnational2, subnational1, country, or custom region code')
    parser.add_argument('--output', help='File to save the output data.')

    args = parser.parse_args()

    # Fetch the taxonomy data
    try:
        data = fetch_region(args.region)
        
        # If an output file is specified, save the data
        if args.output:
            save_to_file(data, args.output)
        else:
            print(data.decode('utf-8'))  # Print the data if no output file is specified
    except Exception as e:
        print(f"Error: {e}")
