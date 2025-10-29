import axios from "axios";

export async function deliverToSlack(
  channelOrUser: string,
  summary: string,
  sheetUrl?: string,
  csvUrl?: string,
  previewRows?: (string | number)[][]
): Promise<void> {
  // Placeholder: send via Vertex AI Extension ext-slack-web
  const payload = {
    channel: channelOrUser,
    text: summary,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "Geofence Route Generator" } },
      { type: "section", text: { type: "mrkdwn", text: summary } },
      { type: "section", fields: [
        { type: "mrkdwn", text: previewRows?.[0] ? `*1.* ${previewRows[0][1]}\n${previewRows[0][2]}` : "" },
        { type: "mrkdwn", text: `${sheetUrl ? `<${sheetUrl}|Open Sheet>` : ""}  •  ${csvUrl ? `<${csvUrl}|Download CSV>` : ""}` }
      ]}
    ]
  };
  void axios; // scaffold only
  void payload;
}

