#!/usr/bin/env python3
"""
Video Metadata Extractor Script

This script:
1. Extracts video IDs from YouTube URLs
2. Queries BigQuery for snippet_published_at data
3. Saves results as CSV

Usage: python video_metadata_extractor.py
"""

import re
import csv
import json
from datetime import datetime
from google.cloud import bigquery
from google.oauth2 import service_account

# YouTube URLs to process
YOUTUBE_URLS = [
    "https://youtube.com/shorts/9ruMhDrkPIE?feature=share",
    "https://youtube.com/shorts/l1PsHtsvC20",
    "https://youtube.com/shorts/6f--vV9inqA",
    "https://youtube.com/shorts/TzsoXZaFdeo?feature=share",
    "https://youtube.com/shorts/vW0aafmhC5g",
    "https://youtube.com/shorts/SPjtOa2A0z8",
    "https://youtube.com/shorts/tqXOk1iPztY",
    "https://youtube.com/shorts/4h4WYEJZjac",
    "https://youtube.com/shorts/3Xd_otzcPgQ",
    "https://youtube.com/shorts/WVW_FA-9t9o?feature=share",
    "https://youtube.com/shorts/imGZKV5bz5c",
    "https://youtube.com/shorts/khLHLVHJrG8",
    "https://youtube.com/shorts/7e3ZQ4GXrok",
    "https://youtube.com/shorts/CKh4WZVJEMY",
    "https://youtube.com/shorts/TG_GFWJXa_U",
    "https://youtube.com/shorts/9rJBSAcyvt0?feature=share",
    "https://youtube.com/shorts/mHYhppliMKs",
    "https://youtube.com/shorts/ngSg0tQzJP0?feature=share",
    "https://youtube.com/shorts/fRTgp906gN0?feature=share",
    "https://youtube.com/shorts/xr1RYo7sIgg?feature=share",
    "https://youtube.com/shorts/D90zDU9HZ30",
    "https://youtube.com/shorts/4lAaNReEUtM",
    "https://youtube.com/shorts/SMEjqfw1RpM?feature=share",
    "https://youtube.com/shorts/KNb7Fz7RmiE?feature=share",
    "https://youtube.com/shorts/diIfNXmKlt0",
    "https://youtube.com/shorts/E7LCdPsQfBc",
    "https://youtube.com/shorts/gffc3OV-xNw",
    "https://youtube.com/shorts/kmgT1QQ5bcw",
    "https://youtube.com/shorts/Np1oat3RQq4",
    "https://youtube.com/shorts/1BDZsiVLow4",
    "https://youtube.com/shorts/BBvvb6sjvsQ",
    "https://youtube.com/shorts/yIB6AodEs0k",
    "https://youtube.com/shorts/aPny7po2gHQ?feature=share",
    "https://youtube.com/shorts/7cagcnxzVPA?feature=share",
    "https://youtube.com/shorts/kr0mX1hESG0",
    "https://youtube.com/shorts/zf8n-GM2t88",
    "https://youtube.com/shorts/VwzLo9t3rV4?feature=share",
    "https://youtube.com/shorts/q-63dJmxRm0",
    "https://youtube.com/shorts/4Dl3QbiDtmE",
    "https://youtube.com/shorts/qoCITveakgI",
    "https://youtube.com/shorts/U3LRwI1Cjik?feature=share",
    "https://youtube.com/shorts/0Wu7RTadNz8",
    "https://youtube.com/shorts/NQGFHFXf62A",
    "https://youtube.com/shorts/tBLLIx4_-b0?feature=share",
    "https://youtube.com/shorts/JDHGgCfxkIs",
    "https://youtube.com/shorts/NBYCiEwo47w",
    "https://youtube.com/shorts/yYEZaeRMwoQ",
    "https://youtube.com/shorts/_7szsA9Ps-8?feature=share",
    "https://youtube.com/shorts/RhgmniZwXL8?feature=share",
    "https://youtube.com/shorts/M25_0JYQ2Fk",
    "https://youtube.com/shorts/VAzd-oCbDm4",
    "https://youtube.com/shorts/EtgT1OT5S48?feature=share",
    "https://youtube.com/shorts/94Zkqdo5MFM",
    "https://youtube.com/shorts/FdGeHUT0TsU",
    "https://youtube.com/shorts/ITZQGuoNtsc",
    "https://youtube.com/shorts/SqStmVvI9nY",
    "https://youtube.com/shorts/Og3J_vIhkEc",
    "https://youtube.com/shorts/F_lzXUh41yI?feature=share",
    "https://youtube.com/shorts/HFAeasqiLIg",
    "https://youtube.com/shorts/m1684LNYtr0",
    "https://youtube.com/shorts/mGopXELgwpM",
    "https://youtube.com/shorts/aJkI98nPf1M"
]

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    # Pattern to match YouTube video IDs in various URL formats
    patterns = [
        r'youtube\.com/shorts/([a-zA-Z0-9_-]+)',
        r'youtube\.com/watch\?v=([a-zA-Z0-9_-]+)',
        r'youtu\.be/([a-zA-Z0-9_-]+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

def setup_bigquery_client():
    """Setup BigQuery client with credentials"""
    try:
        # Use the specific service account file
        credentials_path = '/Users/vishwanathannamalaimuthuraman/Workspace/analytics-plotpointe/writer-dashboard-updated/admin_dashboard.json'

        try:
            with open(credentials_path, 'r') as f:
                credentials_info = json.load(f)
            credentials = service_account.Credentials.from_service_account_info(credentials_info)
            print(f"✅ Loaded credentials from {credentials_path}")
        except FileNotFoundError:
            print(f"❌ Service account file not found: {credentials_path}")
            return None

        # Initialize BigQuery client
        project_id = "speedy-web-461014-g3"
        client = bigquery.Client(credentials=credentials, project=project_id)

        print(f"✅ BigQuery client initialized for project: {project_id}")
        return client

    except Exception as e:
        print(f"❌ Failed to setup BigQuery client: {e}")
        return None

def query_video_metadata(client, video_ids):
    """Query BigQuery for video metadata"""
    if not video_ids:
        print("❌ No video IDs to query")
        return []
    
    # Create the SQL query
    video_ids_str = "', '".join(video_ids)
    query = f"""
    SELECT 
        video_id,
        snippet_published_at,
        snippet_title,
        views,
        writer_name,
        date as snapshot_date
    FROM `speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical`
    WHERE video_id IN ('{video_ids_str}')
    ORDER BY video_id, date DESC
    """
    
    print(f"🔍 Querying BigQuery for {len(video_ids)} video IDs...")
    print(f"📝 Query: {query[:200]}...")
    
    try:
        # Execute the query
        query_job = client.query(query)
        results = query_job.result()
        
        # Convert to list of dictionaries
        rows = []
        for row in results:
            rows.append({
                'video_id': row.video_id,
                'snippet_published_at': row.snippet_published_at.isoformat() if row.snippet_published_at else None,
                'snippet_title': row.snippet_title,
                'views': row.views,
                'writer_name': row.writer_name,
                'snapshot_date': row.snapshot_date.isoformat() if row.snapshot_date else None
            })
        
        print(f"✅ Found {len(rows)} records in BigQuery")
        return rows
        
    except Exception as e:
        print(f"❌ Error querying BigQuery: {e}")
        return []

def save_to_csv(data, filename):
    """Save data to CSV file"""
    if not data:
        print("❌ No data to save")
        return
    
    try:
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['original_url', 'video_id', 'snippet_published_at', 'snippet_title', 'views', 'writer_name', 'snapshot_date']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            # Write header
            writer.writeheader()
            
            # Write data
            for row in data:
                writer.writerow(row)
        
        print(f"✅ Data saved to {filename}")
        
    except Exception as e:
        print(f"❌ Error saving CSV: {e}")

def main():
    """Main function"""
    print("🚀 Starting Video Metadata Extractor...")
    print(f"📊 Processing {len(YOUTUBE_URLS)} URLs")
    
    # Step 1: Extract video IDs
    print("\n📝 Step 1: Extracting video IDs...")
    video_data = []
    unique_video_ids = set()
    
    for url in YOUTUBE_URLS:
        video_id = extract_video_id(url)
        if video_id:
            video_data.append({'url': url, 'video_id': video_id})
            unique_video_ids.add(video_id)
            print(f"   ✅ {url} → {video_id}")
        else:
            print(f"   ❌ Could not extract video ID from: {url}")
    
    print(f"📊 Extracted {len(unique_video_ids)} unique video IDs from {len(YOUTUBE_URLS)} URLs")
    
    # Step 2: Setup BigQuery client
    print("\n🔧 Step 2: Setting up BigQuery client...")
    client = setup_bigquery_client()
    if not client:
        print("❌ Cannot proceed without BigQuery client")
        return
    
    # Step 3: Query BigQuery
    print("\n🔍 Step 3: Querying BigQuery for metadata...")
    metadata_rows = query_video_metadata(client, list(unique_video_ids))
    
    # Step 4: Combine URL data with metadata
    print("\n🔗 Step 4: Combining URL data with metadata...")
    final_data = []
    
    for url_data in video_data:
        video_id = url_data['video_id']
        url = url_data['url']
        
        # Find metadata for this video ID (get the most recent record)
        video_metadata = None
        for metadata in metadata_rows:
            if metadata['video_id'] == video_id:
                video_metadata = metadata
                break
        
        if video_metadata:
            final_data.append({
                'original_url': url,
                'video_id': video_id,
                'snippet_published_at': video_metadata['snippet_published_at'],
                'snippet_title': video_metadata['snippet_title'],
                'views': video_metadata['views'],
                'writer_name': video_metadata['writer_name'],
                'snapshot_date': video_metadata['snapshot_date']
            })
        else:
            # Add row even if no metadata found
            final_data.append({
                'original_url': url,
                'video_id': video_id,
                'snippet_published_at': None,
                'snippet_title': None,
                'views': None,
                'writer_name': None,
                'snapshot_date': None
            })
    
    # Step 5: Save to CSV
    print("\n💾 Step 5: Saving to CSV...")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"video_metadata_{timestamp}.csv"
    save_to_csv(final_data, filename)
    
    print(f"\n🎉 Complete! Results saved to {filename}")
    print(f"📊 Processed {len(final_data)} videos")
    
    # Summary
    found_metadata = sum(1 for row in final_data if row['snippet_published_at'] is not None)
    print(f"✅ Found metadata for {found_metadata}/{len(final_data)} videos")

if __name__ == "__main__":
    main()
