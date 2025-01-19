import sqlite3

def main():
    # Connect to the SQLite database
    conn = sqlite3.connect('top_sites.db')
    cursor = conn.cursor()

    # Create the table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS top_sites (
            rank INTEGER PRIMARY KEY,
            domain TEXT NOT NULL
        )
    ''')

    # Open the CSV file and read lines
    with open('data/traco.csv', 'r') as file:
        for line in file:
            # Strip whitespace and skip empty lines
            line = line.strip()
            if not line:
                continue

            try:
                # Split the line into rank and domain
                rank_str, domain = line.split(',', 1)
                rank = int(rank_str)

                # Insert into the database
                cursor.execute(
                    'INSERT INTO top_sites (rank, domain) VALUES (?, ?)',
                    (rank, domain)
                )
            except ValueError:
                # Skip lines that don't match expected format
                continue

    # Commit changes and close the connection
    conn.commit()