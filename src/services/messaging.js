/** Typed wrapper around chrome.runtime messaging for talking to the worker. */

export async function sendToBackground(request) {
  const response = await chrome.runtime.sendMessage(request);
  if (!response) throw new Error('No response from background worker.');
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
