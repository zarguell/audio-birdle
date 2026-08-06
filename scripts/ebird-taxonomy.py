import argparse
import sys

import ebird_api_common


def fetch_taxonomy(version, category='all', fmt='json', species=None):
    # Get the API key from the environment variable
    api_key = ebird_api_common.load_api_key()

    # Define the URL and headers
    url = 'https://api.ebird.org/v2/ref/taxonomy/ebird'

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

    # Make the request (shared helper: timeout=30, 3 retries with backoff).
    # Return raw content for saving (fmt may be csv or json).
    return ebird_api_common.get_content(url, api_key=api_key, timeout=30, params=params)


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

    # Fetch the taxonomy data; exit non-zero on API/network failure
    try:
        data = fetch_taxonomy(args.version, args.category, args.fmt, args.species)

        # If an output file is specified, save the data
        if args.output:
            save_to_file(data, args.output)
        else:
            print(data.decode('utf-8'))  # Print the data if no output file is specified
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
