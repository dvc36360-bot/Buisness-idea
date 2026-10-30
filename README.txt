VILLAGE GARDEN NURSERY — SINGLE PAGE WEBSITE

FILES
- index.html: the complete single-page website
- stock.csv: the stock data supplied for this project

HOW STOCK UPDATES
The website reads stock.csv from the same folder and refreshes it every 2 minutes.
To update products, replace stock.csv with your latest exported CSV using the same column headings:
ID, ProductName, Category, Description, Price, Quantity, ImageURL, Active

IMPORTANT
This setup reads a CSV file hosted beside the website. It is not a live connection to an Excel app or private cloud spreadsheet. Upload both files to the same website folder. When you replace stock.csv on the hosting service, the website will pick up the new stock on its next refresh.

Open index.html through a web host to allow the browser to fetch stock.csv. Some phones/browsers block CSV fetching when opening the HTML directly as a local file.
