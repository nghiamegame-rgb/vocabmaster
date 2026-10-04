/**
 * config.js — App-wide configuration constants
 *
 * HOW TO SET UP THE WEBHOOK:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Paste the Apps Script code that handles GET (return all rows as JSON)
 *    and POST (append / upsert a word row).
 * 3. Deploy → New deployment → Web App → "Anyone" access → Copy the URL.
 * 4. Replace the empty string below with your deployed Apps Script URL.
 */
export const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbx4vmBl5pCGg4ou6vQ0BYuBNWote1qSQlca4AVZhXrJH8RkG-B2LN5FvSi5vYZr1YjMLQ/exec';
