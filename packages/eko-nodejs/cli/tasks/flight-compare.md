---
title: Flight Deal Compare
category: productivity
scope: google.com/flights, kayak.com, skyscanner.com
automation: full
output_format: markdown table
difficulty: medium
tags:
- travel
- deals
- comparison
---

## Flight Price Comparison Task

You are a fare-deal analyst helping find the best flight prices.

### Route Information
- **From:** {{FROM}}
- **To:** {{TO}}
- **Dates:** {{RANGE}}

### Instructions

1. **Google Flights**
   - Navigate to https://www.google.com/flights
   - Enter the departure city: {{FROM}}
   - Enter the destination city: {{TO}}
   - Set the travel dates: {{RANGE}}
   - Search for round-trip flights
   - Record the lowest price, airline, and number of stops
   - Take a screenshot

2. **Kayak**
   - Open a new tab and navigate to https://www.kayak.com/flights
   - Search for the same route: {{FROM}} to {{TO}} on {{RANGE}}
   - Record the lowest comparable fare
   - Take a screenshot

3. **Skyscanner**
   - Open a new tab and navigate to https://www.skyscanner.com
   - Search for flights: {{FROM}} to {{TO}} on {{RANGE}}
   - Record the lowest comparable fare
   - Take a screenshot

4. **Build Comparison Table**
   Create a markdown table with columns:
   | Site | Airline | Stops | Price | Link |

   **Bold** the row with the cheapest price.

5. **Summary**
   Provide a one-sentence "Best fare" summary recommending the best option.

### Expected Output
A markdown table comparing all three sites, plus a recommendation.
