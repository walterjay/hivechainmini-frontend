/** Phones and tablets: wallet approvals happen in another app, not a browser popup. */
export const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
