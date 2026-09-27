// Native: React Native's FormData accepts a file descriptor object. expo-audio records .m4a (AAC).
export async function voiceForm(uri: string, senderId: string): Promise<FormData> {
  const form = new FormData();
  form.append('senderId', senderId);
  form.append('audio', { uri, name: 'voice.m4a', type: 'audio/mp4' } as unknown as Blob);
  return form;
}
