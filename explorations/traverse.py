import requests

# Define the base URL of the API
BASE_URL = "http://localhost:8000/coordinates"

# Function to make a POST request to the /coordinates endpoint
def get_coordinates(x, y):
    response = requests.post(BASE_URL, json={"x": x, "y": y})
    if response.status_code == 200:
        print(f"Coordinates ({x}, {y}): {response.json()}")
    else:
        print(f"Failed to get coordinates ({x}, {y}): {response.status_code}")

# Loop to make requests for 50 layers diagonally
for i in range(3):
    get_coordinates(i, i)
