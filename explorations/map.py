import json
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Load the coordinates map from the JSON file
with open('coordinates_ma.json', 'r') as f:
    coordinates_map = json.load(f)

# Determine the size of the grid
min_x = min(int(key.split(',')[0]) for key in coordinates_map.keys())
max_x = max(int(key.split(',')[0]) for key in coordinates_map.keys())
min_y = min(int(key.split(',')[1]) for key in coordinates_map.keys())
max_y = max(int(key.split(',')[1]) for key in coordinates_map.keys())

# Create a figure and axis
fig, ax = plt.subplots(figsize=(10, 10))

# Add a rectangle for each coordinate
for key, domain in coordinates_map.items():
    x, y = map(int, key.split(','))
    rect = patches.Rectangle((x, y), 1, 1, linewidth=1, edgecolor='black', facecolor='lightblue')
    ax.add_patch(rect)
    plt.text(x + 0.5, y + 0.5, domain, ha='center', va='center', fontsize=6)

# Set the limits and labels
ax.set_xlim(min_x - 1, max_x + 1)
ax.set_ylim(min_y - 1, max_y + 1)
ax.set_xticks(range(min_x, max_x + 1))
ax.set_yticks(range(min_y, max_y + 1))
ax.set_xticklabels(range(min_x, max_x + 1))
ax.set_yticklabels(range(min_y, max_y + 1))
ax.set_xlabel('X Coordinate')
ax.set_ylabel('Y Coordinate')
ax.set_title('2D Representation of Coordinates Map')
ax.grid(True)

# Show the plot
plt.gca().invert_yaxis()
plt.show()
