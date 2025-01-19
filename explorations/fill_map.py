import requests
import random
import json

# Define the base URL for the FastAPI server
BASE_URL = "http://localhost:8000"

# Define the starting point
current_x, current_y = 0, 0

# Define the number of steps to take
num_steps = 500

# Define the directions
directions = [
    (0, 1),  # up
    (0, -1), # down
    (1, 0),  # right
    (-1, 0)  # left
]

# Initialize the coordinates map
coordinates_map = {}

# Function to get coordinates from the server
def get_coordinates(x, y, source_x, source_y):
    payload = {
        "x": x,
        "y": y,
        "source_x": source_x,
        "source_y": source_y
    }
    response = requests.post(f"{BASE_URL}/coordinates", json=payload)
    if response.status_code == 200:
        data = response.json()
        return data["domain"]
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None

# Fill the map by walking randomly
for _ in range(num_steps):
    # Get the domain for the current coordinate
    domain = get_coordinates(current_x, current_y, current_x, current_y)
    if domain:
        coordinates_map[f"{current_x},{current_y}"] = domain

    # Choose a random direction to move
    direction = random.choice(directions)
    new_x = current_x + direction[0]
    new_y = current_y + direction[1]

    # Update the current position
    current_x, current_y = new_x, new_y

# Save the coordinates map to a JSON file
with open('coordinates_map_filled.json', 'w') as f:
    json.dump(coordinates_map, f)

print("Map filling complete. Saved to coordinates_map_filled.json.")
