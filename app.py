import os
import time
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
    response = requests.get(FEED_URL, headers=headers, timeout=15)
    response.raise_for_status()
    
    root = ET.fromstring(response.content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    feed_title = root.find('atom:title', ns)
    feed_title_text = feed_title.text if feed_title is not None else "BigQuery Release Notes"
    
    feed_updated = root.find('atom:updated', ns)
    feed_updated_text = feed_updated.text if feed_updated is not None else ""
    
    entries = root.findall('atom:entry', ns)
    parsed_entries = []
    
    for entry in entries:
        title_elem = entry.find('atom:title', ns)
        updated_elem = entry.find('atom:updated', ns)
        id_elem = entry.find('atom:id', ns)
        content_elem = entry.find('atom:content', ns)
        
        date_str = title_elem.text if title_elem is not None else "Unknown Date"
        updated_str = updated_elem.text if updated_elem is not None else ""
        entry_id = id_elem.text if id_elem is not None else ""
        
        # Extract simple anchor ID from entry ID or date
        anchor_id = ""
        if entry_id and '#' in entry_id:
            anchor_id = entry_id.split('#')[-1]
        else:
            anchor_id = date_str.replace(" ", "_").replace(",", "")

        content_html = content_elem.text if content_elem is not None else ""
        
        items = []
        if content_html:
            soup = BeautifulSoup(content_html, 'html.parser')
            
            # Check for headings (h3)
            h3_tags = soup.find_all('h3')
            
            if not h3_tags:
                # Put all contents in a single item if there are no headings
                items.append({
                    'type': 'Announcement',
                    'content': content_html.strip()
                })
            else:
                # Group by h3 headings
                current_type = "Announcement"
                current_parts = []
                
                for child in soup.contents:
                    if child.name == 'h3':
                        if current_parts:
                            items.append({
                                'type': current_type,
                                'content': "".join(str(c) for c in current_parts).strip()
                            })
                            current_parts = []
                        current_type = child.get_text().strip()
                    else:
                        current_parts.append(child)
                        
                # Add remaining parts
                if current_parts:
                    items.append({
                        'type': current_type,
                        'content': "".join(str(c) for c in current_parts).strip()
                    })
        
        parsed_entries.append({
            'id': entry_id,
            'anchor_id': anchor_id,
            'date': date_str,
            'updated': updated_str,
            'items': items
        })
        
    return {
        'feed_title': feed_title_text,
        'feed_updated': feed_updated_text,
        'last_cached': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime()),
        'entries': parsed_entries
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    try:
        data = fetch_and_parse()
        return jsonify(data)
    except Exception as e:
        return jsonify({
            'error': 'Failed to retrieve release notes',
            'details': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
