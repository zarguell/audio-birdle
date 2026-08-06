import argparse
import sys

import ebird_api_common


def fetch_region(region):
    # Get the API key from the environment variable
    api_key = ebird_api_common.load_api_key()

    # Define the URL
    url = 'https://api.ebird.org/v2/ref/region/list/subnational1/' + region

    # Make the request (shared helper: timeout=30, 3 retries with backoff).
    # Return raw content for saving.
    return ebird_api_common.get_content(url, api_key=api_key, timeout=30)


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

    # Fetch the data; exit non-zero on API/network failure
    try:
        data = fetch_region(args.region)

        # If an output file is specified, save the data
        if args.output:
            save_to_file(data, args.output)
        else:
            print(data.decode('utf-8'))  # Print the data if no output file is specified
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
