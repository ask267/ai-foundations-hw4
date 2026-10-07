// Open the chat from anywhere on the site (e.g. "Ask Dan about this" on a
// product page), optionally sending a message straight away.
export const ASK_DAN_EVENT = 'campus-customs:ask-dan'

export function askDan(message?: string) {
  window.dispatchEvent(new CustomEvent(ASK_DAN_EVENT, { detail: { message } }))
}
