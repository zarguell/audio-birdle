
import argparse
import json
import pandas as pd
import requests
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

from bs4 import BeautifulSoup as Soup
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.common import exceptions
from selenium.webdriver.chrome.service import Service

# ------------- 
def ConstructRequestUrl(taxonCode:str, tag:str, regionCode:str) -> str:
  baseUrl = 'https://media.ebird.org/catalog?'
  return baseUrl + f'tag={tag}&regionCode={regionCode}&taxonCode={taxonCode}'

def GetMoreResultsButton(browser, cssSelector):
  try:
    button = browser.find_element(By.CSS_SELECTOR, cssSelector)
  except exceptions.NoSuchElementException:
    return
  else:
    return button

def GetSpeciesNextPagesUrl(driver, reqUrl, speciesCode, maxUrls):
  df = pd.DataFrame(columns=['code', 'page Url'])
  driver.get(reqUrl)
  button = GetMoreResultsButton(driver, '.pagination > button')
  while button is not None and len(df) < maxUrls:
    button.click()
    button = GetMoreResultsButton(driver, '.pagination > button')
  
  soup = Soup(driver.page_source, 'lxml')
  nextPageUrls = soup.find_all('a', class_='ResultsGallery-link')
  for u in nextPageUrls[:maxUrls]:  # Limit to maxUrls
    df = pd.concat(
      [df, pd.DataFrame({
        'code': speciesCode,
        'page Url': u.get('href')
      }, index=[0])],
      ignore_index=True
    )
  return df

def GetSpeciesAudioUrls(driver, reqUrls, speciesCodes):
  audioUrls = []
  for reqUrl, code in zip(reqUrls, speciesCodes):
    try:
      driver.get(reqUrl)
      soup = Soup(driver.page_source, 'lxml')
      if soup.find('audio') is not None:
        audioUrls.append(soup.find('audio').get('src'))
        print(f"✅ Found audio for {code}: {reqUrl}")
      elif soup.find('video') is not None:
        audioUrls.append(soup.find('video').get('src'))
        print(f"✅ Found video for {code}: {reqUrl}")
      else:
        audioUrls.append(None)  # No audio/video found
        print(f"⚠️  No audio/video found for {code}: {reqUrl}")
    except Exception as e:
      audioUrls.append(None)  # Error occurred
      print(f"❌ Error processing {code} ({reqUrl}): {e}")
  return audioUrls

def DownloadAudio(speciesCode, url):
  filename = f'{speciesCode}_ML' + url.split('/')[6] + '.mp3'
  filePath = Path.cwd().joinpath('audio', 'eBird', f'{filename}')
  res = requests.get(url)
  with open(filePath, 'wb') as f:
    for data in res.iter_content(1024):
      f.write(data)

# -------------
def main():
    parser = argparse.ArgumentParser(description="Scrape audio URLs from eBird taxonomy data.")
    parser.add_argument("taxonomy_file", type=Path, help="Path to a taxonomy JSON file (e.g., us-taxonomy.json)")
    parser.add_argument("--max-urls", type=int, default=10, help="Maximum number of audio URLs to get per species (default: 10)")
    parser.add_argument("--region", type=str, default="US", help="Region code (default: US)")
    parser.add_argument("--tag", type=str, default="song", help="Media tag (default: song)")

    args = parser.parse_args()

    # Set up Chrome driver
    service = Service(Path.cwd().joinpath('chromedriver'))
    chromedriver_loc = '/opt/homebrew/bin/chromedriver'
    driver = webdriver.Chrome()

    urlDF = pd.DataFrame(columns=['code', 'page Url'])

    # Load taxonomy JSON and extract speciesCode
    try:
        with open(args.taxonomy_file, 'r', encoding='utf-8') as f:
            taxonomy = json.load(f)
    except Exception as e:
        print(f"Error loading taxonomy file: {e}")
        driver.quit()
        return

    print(f"📊 Processing {len(taxonomy)} species...")
    
    for i, entry in enumerate(taxonomy, 1):
        species_code = entry.get("speciesCode")
        if not species_code:
            continue

        print(f"🔍 [{i}/{len(taxonomy)}] Processing species: {species_code}")
        reqUrl = ConstructRequestUrl(species_code, args.tag, args.region)
        tempDF = GetSpeciesNextPagesUrl(driver, reqUrl, species_code, args.max_urls)
        print(f"   Found {len(tempDF)} page URLs for {species_code}")
        urlDF = pd.concat([urlDF, tempDF], ignore_index=True)

    print(f"\n📋 Total page URLs collected: {len(urlDF)}")
    print("🎵 Fetching audio URLs...")
    
    # Download and save audio, and save its URL
    audioUrls = GetSpeciesAudioUrls(driver, urlDF['page Url'], urlDF['code'])
    
    # Ensure lengths match (should now be guaranteed)
    if len(audioUrls) != len(urlDF):
        print(f"⚠️  Warning: Length mismatch - {len(audioUrls)} audio URLs vs {len(urlDF)} page URLs")
        # Pad with None if needed
        while len(audioUrls) < len(urlDF):
            audioUrls.append(None)
    
    urlDF['audio Url'] = audioUrls

    # Generate output filename based on input filename
    input_stem = args.taxonomy_file.stem
    output_file = args.taxonomy_file.parent / f"{input_stem}-urls.json"
    
    # Save to JSON file
    urlDF.to_json(output_file, orient='records', indent=2)
    
    # Print summary
    successful_urls = urlDF['audio Url'].notna().sum()
    total_urls = len(urlDF)
    print(f"\n📊 Summary:")
    print(f"   Total page URLs: {total_urls}")
    print(f"   Successful audio URLs: {successful_urls}")
    print(f"   Failed/missing: {total_urls - successful_urls}")
    print(f"✅ Audio URLs saved to {output_file}")

    # Close Chrome
    driver.quit()

if __name__ == '__main__':
    main()
