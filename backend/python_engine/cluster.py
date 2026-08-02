import sys
import json
import time
import numpy as np
import requests
from sklearn.cluster import DBSCAN

# Fallback import for HDBSCAN (included in scikit-learn 1.3+)
try:
    from sklearn.cluster import HDBSCAN
    HAS_HDBSCAN = True
except ImportError:
    HAS_HDBSCAN = False

def get_embeddings(texts, api_key):
    """
    Fetches embeddings in batches of 100 using the Gemini Embedding API.
    """
    embeddings = []
    batch_size = 100
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        requests_list = []
        for text in batch:
            requests_list.append({
                "model": "models/gemini-embedding-001",
                "content": {
                    "parts": [{"text": text}]
                },
                "outputDimensionality": 768
            })
            
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={api_key}"
        try:
            response = requests.post(url, json={"requests": requests_list}, timeout=30)
            if response.status_code != 200:
                raise Exception(f"Embedding API error: {response.text}")
            
            result = response.json()
            # Extract embedding values
            for emb in result.get("embeddings", []):
                embeddings.append(emb["values"])
        except Exception as e:
            sys.stderr.write(f"Error fetching embeddings batch: {str(e)}\n")
            # Fill with zeros as fallback
            for _ in range(len(batch)):
                embeddings.append([0.0] * 768)
                
    return np.array(embeddings)

def get_gemini_theme_summary(cluster_texts, api_key):
    """
    Asks Gemini to summarize a cluster of feedback and output a structured JSON theme.
    """
    prompt = f"""
You are a Product Feedback Analysis Agent.
Analyze the following related customer feedback entries:
{chr(10).join(f"- {txt}" for txt in cluster_texts)}

Synthesize this feedback into a single, unified customer theme.
You must output a JSON object with the following fields:
- title: A concise, descriptive name of the theme (e.g. "Safari PDF Export Crashes").
- problem_statement: A specific, details-rich problem statement detailing the user pain, behavior, and outcome. IMPORTANT: Keep it extremely concise, maximum 150 characters (around 1-2 short sentences).

Provide your output strictly in JSON format matching the schema. No markdown formatting.
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "problem_statement": {"type": "string"},
                    "primary_product_area": {"type": "string"}
                },
                "required": ["title", "problem_statement", "primary_product_area"]
            }
        }
    }
    
    max_retries = 5
    backoff = 2.0
    for attempt in range(max_retries):
        try:
            # Small delay to throttle requests under free tier RPM
            time.sleep(1.0)
            response = requests.post(url, json=payload, timeout=20)
            
            if response.status_code == 429:
                sys.stderr.write(f"Rate limited (429) on theme summary. Retrying in {backoff}s (attempt {attempt+1}/{max_retries})...\n")
                time.sleep(backoff)
                backoff *= 2
                continue
                
            if response.status_code != 200:
                raise Exception(f"Gemini API error: {response.text}")
            
            result = response.json()
            text_content = result["candidates"][0]["content"]["parts"][0]["text"]
            data = json.loads(text_content)
            
            # Enforce capping on problem statement length (safety truncate if LLM went over)
            if len(data.get("problem_statement", "")) > 165:
                data["problem_statement"] = data["problem_statement"][:160] + "..."
                
            return data
            
        except Exception as e:
            sys.stderr.write(f"Attempt {attempt+1} failed: {str(e)}\n")
            if attempt == max_retries - 1:
                # Return fallback values if all retries fail
                return {
                    "title": f"Clustered Issue ({len(cluster_texts)} items)",
                    "problem_statement": "Multiple users reported similar issues in this product area.",
                    "primary_product_area": "Unassigned"
                }
            time.sleep(backoff)
            backoff *= 1.5
            
    return {
        "title": f"Clustered Issue ({len(cluster_texts)} items)",
        "problem_statement": "Multiple users reported similar issues in this product area.",
        "primary_product_area": "Unassigned"
    }

def process_outliers(outlier_rows, api_key):
    """
    Processes outliers in a rate-limit friendly batch call, asking Gemini to synthesize them into individual themes.
    """
    themes = []
    batch_size = 15 # Process in small batches
    
    for i in range(0, len(outlier_rows), batch_size):
        batch = outlier_rows[i:i+batch_size]
        items_list = [f"Row {item['row_id']}: [Area: {item['product_area']}] {item['feedback_text']}" for item in batch]
        
        prompt = f"""
Analyze the following isolated, independent feedback comments:
{chr(10).join(items_list)}

For each comment, write a very brief theme title, a concise problem statement, and specify its product area.
Output a JSON list of themes. Each theme must contain:
- supporting_row_id: The integer Row ID of the comment.
- title: Concise title.
- problem_statement: Concise problem statement.
- primary_product_area: Product area.

Output strictly as a JSON object:
{{
  "themes": [
     {{
       "supporting_row_id": 4,
       "title": "...",
       "problem_statement": "...",
       "primary_product_area": "..."
     }}
  ]
}}
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "object",
                    "properties": {
                        "themes": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "supporting_row_id": {"type": "integer"},
                                    "title": {"type": "string"},
                                    "problem_statement": {"type": "string"},
                                    "primary_product_area": {"type": "string"}
                                },
                                "required": ["supporting_row_id", "title", "problem_statement", "primary_product_area"]
                            }
                        }
                    },
                    "required": ["themes"]
                }
            }
        }
        
        max_retries = 5
        backoff = 2.0
        success = False
        
        for attempt in range(max_retries):
            try:
                time.sleep(1.0)
                response = requests.post(url, json=payload, timeout=20)
                
                if response.status_code == 429:
                    sys.stderr.write(f"Rate limited (429) on outlier batch. Retrying in {backoff}s (attempt {attempt+1}/{max_retries})...\n")
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                    
                if response.status_code != 200:
                    raise Exception(f"Outlier API status {response.status_code}: {response.text}")
                
                result = response.json()
                text_content = result["candidates"][0]["content"]["parts"][0]["text"]
                batch_themes = json.loads(text_content).get("themes", [])
                for t in batch_themes:
                    prob = t.get("problem_statement", "")
                    if len(prob) > 165:
                        prob = prob[:160] + "..."
                    themes.append({
                        "title": t["title"],
                        "problem_statement": prob,
                        "primary_product_area": t["primary_product_area"],
                        "supporting_row_ids": [t["supporting_row_id"]],
                        "is_pattern": False
                    })
                success = True
                break
            except Exception as e:
                sys.stderr.write(f"Outlier batch attempt {attempt+1} failed: {str(e)}\n")
                time.sleep(backoff)
                backoff *= 1.5
                
        if not success:
            sys.stderr.write("Error batch-processing outliers after max retries, using fallbacks.\n")
            for item in batch:
                themes.append({
                    "title": f"Isolated comment: {item['product_area']}",
                    "problem_statement": item['feedback_text'][:150],
                    "primary_product_area": item['product_area'],
                    "supporting_row_ids": [item['row_id']],
                    "is_pattern": False
                })
                
    return themes

def cosine_similarity(v1, v2):
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(v1, v2) / (norm1 * norm2))

def main():
    sys.stderr.write("Starting Python Clustering Engine...\n")
    
    # Read input JSON from stdin
    try:
        input_data = json.loads(sys.stdin.read())
    except Exception as e:
        sys.stderr.write(f"Error parsing input JSON: {str(e)}\n")
        sys.exit(1)
        
    feedback_items = input_data.get("feedback_items", [])
    historical_themes = input_data.get("historical_themes", [])
    product_notes = input_data.get("product_notes", [])
    api_key = input_data.get("gemini_api_key", "")
    
    if not feedback_items:
        print(json.dumps({"themes": []}))
        return
        
    if not api_key:
        sys.stderr.write("Error: GEMINI_API_KEY is not provided.\n")
        sys.exit(1)
        
    # Extract feedback texts
    texts = [item["feedback_text"] for item in feedback_items]
    
    # Get embeddings for all feedback items
    sys.stderr.write(f"Generating embeddings for {len(texts)} items...\n")
    embeddings = get_embeddings(texts, api_key)
    
    # Fit clustering model (HDBSCAN or DBSCAN)
    sys.stderr.write("Running clustering algorithm...\n")
    if HAS_HDBSCAN and len(embeddings) >= 5:
        # Use HDBSCAN if available and we have enough data
        clusterer = HDBSCAN(min_cluster_size=2, metric='euclidean', cluster_selection_method='eom')
        labels = clusterer.fit_predict(embeddings)
    else:
        # Fallback to DBSCAN
        # eps = 0.5 is a reasonable default for cosine/euclidean distance on normalized embeddings
        clusterer = DBSCAN(eps=0.4, min_samples=2, metric='euclidean')
        labels = clusterer.fit_predict(embeddings)
        
    # Group row IDs by cluster
    clusters = {}
    outliers = []
    
    for idx, label in enumerate(labels):
        row_id = feedback_items[idx]["row_id"]
        if label == -1:
            outliers.append(feedback_items[idx])
        else:
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(idx)
            
    final_themes = []
    
    # Process clustered themes
    for label, indices in clusters.items():
        sys.stderr.write(f"Processing cluster {label} with {len(indices)} rows...\n")
        cluster_rows = [feedback_items[idx] for idx in indices]
        cluster_texts = [row["feedback_text"] for row in cluster_rows]
        cluster_embeddings = embeddings[indices]
        
        # Get theme definition from Gemini
        theme_info = get_gemini_theme_summary(cluster_texts, api_key)
        
        # Calculate cluster centroid embedding
        centroid = np.mean(cluster_embeddings, axis=0)
        
        # Check similarity with historical themes
        matched_history_ids = []
        for hist in historical_themes:
            hist_emb = hist.get("embedding")
            if hist_emb and len(hist_emb) == 768:
                sim = cosine_similarity(centroid, np.array(hist_emb))
                if sim > 0.65: # Cosine similarity threshold
                    matched_history_ids.append(hist["id"])
                        
        # Check similarity with product notes
        matched_note_ids = []
        for note in product_notes:
            note_emb = note.get("embedding")
            if note_emb and len(note_emb) == 768:
                sim = cosine_similarity(centroid, np.array(note_emb))
                if sim > 0.65:
                    matched_note_ids.append(note["id"])
                        
        final_themes.append({
            "title": theme_info["title"],
            "problem_statement": theme_info["problem_statement"],
            "primary_product_area": theme_info["primary_product_area"],
            "supporting_row_ids": [row["row_id"] for row in cluster_rows],
            "is_pattern": True,
            "matched_historical_theme_ids": matched_history_ids,
            "matched_product_note_ids": matched_note_ids,
            "embedding": centroid.tolist()
        })
        
    # Process outliers (isolated comments)
    if outliers:
        sys.stderr.write(f"Processing {len(outliers)} outliers...\n")
        outlier_themes = process_outliers(outliers, api_key)
        
        # Get embeddings for outliers to store in DB
        for t in outlier_themes:
            row_id = t["supporting_row_ids"][0]
            # Find index in feedback_items
            item_idx = next(i for i, item in enumerate(feedback_items) if item["row_id"] == row_id)
            t["embedding"] = embeddings[item_idx].tolist()
            t["matched_historical_theme_ids"] = []
            t["matched_product_note_ids"] = []
            final_themes.append(t)
            
    # Print result to stdout
    print(json.dumps({"themes": final_themes}))
    sys.stderr.write("Python Clustering Engine completed successfully.\n")

if __name__ == "__main__":
    main()
