//esta funcion transcribe pero no tiene reconocimiento de voz:
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import MicrophoneStream from "microphone-stream";
import { Buffer } from "buffer";

// UPDATE THIS ACCORDING TO YOUR AWS CREDENTIALS:
//import { aws_region, aws_id,  } from "../aws";

const aws_region = process.env.AWS_REGION;
const aws_id = process.env.AWS_ID;
const aws_secretkey = process.env.AWS_SECRETKEY;

let microphoneStream = undefined;
const language = "es-US";
const SAMPLE_RATE = 44100;
let transcribeClient = undefined; //9039300026

const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const transcriptionDiv = document.getElementById("transcription");

let transcription = "";

startButton.addEventListener("click", async () => {
  console.log("dddd");
  await startRecording((text) => {
    transcription += text;
    transcriptionDiv.innerHTML = transcription;
  });
});

stopButton.addEventListener("click", () => {
  console.log("stopbutton");
  stopRecording();
  transcription = "";
  transcriptionDiv.innerHTML = "";
});

const createMicrophoneStream = async () => {
  microphoneStream = new MicrophoneStream();
  microphoneStream.setStream(
    await window.navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    })
  );
};

const createTranscribeClient = () => {
  console.log("createTranscribeClient");
  transcribeClient = new TranscribeStreamingClient({
    region: aws_region,
    credentials: {
      accessKeyId: aws_id,
      secretAccessKey: aws_secretkey,
    },
  });
};

const encodePCMChunk = (chunk) => {
  const input = MicrophoneStream.toRaw(chunk);
  let offset = 0;
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return Buffer.from(buffer);
};

const getAudioStream = async function* () {
  for await (const chunk of microphoneStream) {
    if (chunk.length <= SAMPLE_RATE) {
      yield {
        AudioEvent: {
          AudioChunk: encodePCMChunk(chunk),
        },
      };
    }
  }
};

const startStreaming = async (language, callback) => {
  const command = new StartStreamTranscriptionCommand({
    LanguageCode: language,
    MediaEncoding: "pcm",
    MediaSampleRateHertz: SAMPLE_RATE,
    AudioStream: getAudioStream(),
  });
  const data = await transcribeClient.send(command);
  for await (const event of data.TranscriptResultStream) {
    const results = event.TranscriptEvent.Transcript.Results;
    if (results.length && !results[0]?.IsPartial) {
      const newTranscript = results[0].Alternatives[0].Transcript;
      console.log(newTranscript);
      callback(newTranscript + " ");
    }
  }
};

export const startRecording = async (callback) => {
  if (!aws_region || !aws_id || !aws_secretkey) {
    alert("Set AWS env variables first.");
    console.log("startRecording");
    return false;
  }
  console.log("startRecording2");

  if (microphoneStream || transcribeClient) {
    stopRecording();
  }
  createTranscribeClient();
  createMicrophoneStream();
  await startStreaming(language, callback);
};

export const stopRecording = function () {
  console.log("stopRecording");
  if (microphoneStream) {
    microphoneStream.stop();
    microphoneStream.destroy();
    microphoneStream = undefined;
  }
};
