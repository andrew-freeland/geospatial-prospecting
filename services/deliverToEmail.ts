import axios from "axios";

export async function deliverToEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  // Placeholder: send via Vertex AI Extension ext-gmail (users.messages.send)
  void axios; // scaffold only
  void to;
  void subject;
  void htmlBody;
}

