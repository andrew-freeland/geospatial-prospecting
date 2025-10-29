import axios from "axios";

export async function sheetWriter(
  title: string,
  table: { headers: string[]; rows: (string | number)[][] }
): Promise<{ url: string; spreadsheetId: string }> {
  // Placeholder: use Vertex AI Extension ext-google-sheets to create and populate
  // For scaffold, return a dummy URL
  const spreadsheetId = `sheet_${Date.now()}`;
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  void axios; // keep import for scaffold
  return { url, spreadsheetId };
}

