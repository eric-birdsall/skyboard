# Skyboard

Skyboard is a weather dashboard you can rearrange. It's a static site with no build step, so it runs on GitHub Pages as is.

## Features

- **Tiles you can rearrange:** drag a tile by its header to move it (long-press on touch screens). Use ⤢ to cycle a tile's size and × to remove it. **Customize** (the grid icon) lets you add tiles back or reset the layout. On phones, use **Customize → Edit layout** to show the tile controls.
- **Tiles available:** Now, Hourly (24 h with a temperature curve), 10-day, Precipitation, Wind (compass), UV index, Sunrise and sunset, Air quality (US AQI), Humidity and dew point, Feels like, Pressure (with trend), Visibility, and Saved places.
- **Weather icons:** SVG icons for sunny, clear night, partly cloudy, overcast, fog, drizzle, rain, showers, snow, sleet and thunderstorms. The icon in the main tile is animated.
- **Light and dark mode:** the theme button cycles through auto (follows your system), light and dark. The background glow changes with the current weather and time of day.
- **Saved locations:** search any city or use your device's location, then switch between places with the chips under the header.
- **Remembered settings:** layout, tile sizes, saved locations, active location, units (°F/°C) and theme are stored in `localStorage`. Forecasts are cached for 10 minutes, so the page loads instantly, and refresh automatically every 15 minutes.

## Free APIs (no keys needed)

| Purpose | API |
|---|---|
| Forecast (current, hourly, daily) | [Open-Meteo Forecast](https://open-meteo.com/en/docs) |
| Air quality | [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) |
| City search | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) |
| City name for "Use my location" | [BigDataCloud reverse geocode (client)](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) |

Weather data is © Open-Meteo.com under CC BY 4.0. The footer carries the required credit.

Drag and drop uses [SortableJS](https://github.com/SortableJS/Sortable) 1.15.2 from cdnjs.

## Run locally

The JavaScript is loaded as ES modules, so you need to serve the folder; opening `index.html` directly won't work:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository, with the files at the repository root.
2. Go to **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. Your site will be at `https://<user>.github.io/<repo>/`.

All paths are relative, so the site works from a project subpath. `.nojekyll` turns off Jekyll processing.

## Project layout

```
index.html            markup, header, sheets
css/style.css         theme tokens (light/dark), grid, tiles
js/app.js             state, data fetching, tile renderers, drag/drop, sheets
js/icons.js           SVG weather icons + WMO weather-code mapping
favicon.svg, manifest.webmanifest, .nojekyll
```

To add a tile, add an entry to `TILES` and a matching renderer `R.<id>` in `js/app.js`.
