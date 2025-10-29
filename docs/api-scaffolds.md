## API Scaffolds (per spec)

- Google Places Nearby Search (`ext-google-places`):
  - GET `https://maps.googleapis.com/maps/api/place/nearbysearch/json`
  - Params: `location`, `radius`, `type?`, `opennow`, `pagetoken?`

- Google Directions (`ext-google-directions`):
  - GET `https://maps.googleapis.com/maps/api/directions/json`
  - Params: `origin`, `destination`, `waypoints` (optimize:true), `mode=driving`, `departure_time=now`

- Google Sheets (`ext-google-sheets`):
  - POST `spreadsheets` (create)
  - POST `spreadsheets/{id}/values/{range}:append` (write rows)

- Google Drive (`ext-google-drive`):
  - POST `upload/drive/v3/files?uploadType=multipart` (upload CSV)
  - POST `drive/v3/files/{fileId}/permissions` (share link)

- Slack (`ext-slack-web`):
  - POST `https://slack.com/api/chat.postMessage`

- Gmail (`ext-gmail`):
  - POST `gmail/v1/users/me/messages/send`
