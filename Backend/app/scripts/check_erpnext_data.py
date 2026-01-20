import requests
import json
import sys

# ERPNext Simulator is running on port 8000 (mapped to 9000 or 9010 on host, but we can access it via service name if inside container, or localhost port if outside)
# Since we are running on the host (mac), we should use the mapped port.
# docker-compose.yml says erpnext ports: "9010:8000"
BASE_URL = "http://localhost:9010"

HEADERS = {
    "Authorization": "token test_key:test_secret", # Using test credentials from erpnext_client.py
    "Content-Type": "application/json"
}

def fetch_table(resource):
    print(f"\n--- Table: {resource} ---")
    try:
        response = requests.get(f"{BASE_URL}/api/resource/{resource}", headers=HEADERS)
        if response.status_code == 200:
            data = response.json().get("data", [])
            print(f"Count: {len(data)}")
            if data:
                # Print headers
                headers = list(data[0].keys())
                print(" | ".join(headers))
                print("-" * 50)
                for row in data:
                    print(" | ".join(str(row.get(h, '')) for h in headers))
            else:
                print("(Empty)")
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Failed to connect: {e}")

def main():
    print(f"Connecting to ERPNext Simulator at {BASE_URL}...")
    
    resources = ["Customer", "Item", "Warehouse", "Stock Entry", "Sales Person", "Sales Invoice"]
    
    for res in resources:
        fetch_table(res)

if __name__ == "__main__":
    main()
