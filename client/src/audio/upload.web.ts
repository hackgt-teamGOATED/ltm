// Web: the recording URI is a blob: URL. Read it back as a Blob and name it by its real type.
const EXT: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3' };

export async function voiceForm(uri: string, senderId: string): Promise<FormData> {
  const blob = await (await fetch(uri)).blob();
  URL.revokeObjectURL(uri);
  const type = (blob.type || 'audio/mp4').split(';')[0];
  const form = new FormData();
  form.append('senderId', senderId);
  form.append('audio', blob, `voice.${EXT[type] ?? 'm4a'}`);
  return form;
}
