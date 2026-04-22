default:
    @just --list

# Start the development server
dev:
    npm run dev

# Build the static site
build:
    npm run build

# Preview the built site
preview:
    npm run preview

# Install dependencies
setup:
    npm install

# Import a trip from a folder of images (extracts EXIF data)
# Usage: just import-trip <image-dir> <trip-slug>
import-trip dir slug:
    node scripts/import-trip.mjs {{dir}} {{slug}}

# Clean build output
clean:
    rm -rf dist
