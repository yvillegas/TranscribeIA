import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import MicrophoneStream from "microphone-stream";
import { Buffer } from "buffer";

import OpenAI from "openai";
const aws_region = process.env.AWS_REGION;
const aws_id = process.env.AWS_ID;
const aws_secretkey = process.env.AWS_SECRETKEY;

let microphoneStream = undefined;
const language = "es-US";
const SAMPLE_RATE = 44100;
let transcribeClient = undefined;

const startButton = document.getElementById("startRecording");
const stopButton = document.getElementById("stopRecording");
const transcriptionDiv = document.getElementById("transcription");

let transcription = "";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

startButton.addEventListener("click", async () => {
  console.log("dddd");
  document.getElementById("mic").classList.add("recording");
  document.getElementById("startRecording").style.display = "none";
  document.getElementById("stopRecording").style.display = "inline-block";
  await startRecording((text) => {
    transcription += text;
    transcriptionDiv.innerHTML = transcription;
  });
});

stopButton.addEventListener("click", async () => {
  console.log("stopbutton");
  stopRecording();
  document.getElementById("mic").classList.remove("recording");
  document.getElementById("stopRecording").style.display = "none";
  document.getElementById("formContainer").style.display = "block";

  // transcription =
  //   "Speaker 0: me llamo Janina. Tengo veintiuno años hace dos años tengo dolores de cabeza, en la parte frontal. Speaker 0: cada semana tengo dolores de cabeza. Speaker 0: mi padres, ambos tienen diabetes. Speaker 0: desde hace aproximadamente cinco años. Mi mamá y hace seis años mi papá. Speaker 0: no tengo más antecedentes familiares. Speaker 0: vivo en calle. Speaker 0: son ciento cinco en Arequipa. Speaker 0: nacido el diecinueve de septiembre de mil novecientos noventa y nueve. Speaker 0: actualmente tomó Fermentina y. Speaker 0: en las noches tomó algunas pastillas para el lado de la cabeza.";
  transcriptionDiv.innerHTML = transcription;
  //return;
  const data = await formatearHistoriaClinica(transcription);

  var paciente = JSON.parse(data);
  transcriptionDiv.innerHTML = transcriptionDiv.innerHTML;
  // Paciente
  document.getElementById("namePatient").value = paciente.info.namePatient; // Nombre del paciente
  document.getElementById("agePatient").value = paciente.info.agePatient; // Edad del paciente
  document.getElementById("dateConsultation").value =
    paciente.info.dateConsultation; // Fecha de la consulta
  document.getElementById("numberHc").value = paciente.info.numberHc; // Número de Historia Clínica

  // Motivo de consulta
  document.getElementById("reasonConsultation").value =
    paciente.info.reasonConsultation; // Motivo de la consulta

  // Datos Personales
  document.getElementById("datePatient").value = paciente.info.datePatient; // Fecha de nacimiento del paciente
  document.getElementById("sexPatient").value = paciente.info.sexPatient; // Sexo del paciente
  document.getElementById("statusMaritalPatient").value =
    paciente.info.statusMaritalPatient; // Estado civil del paciente
  document.getElementById("nationalityPatient").value =
    paciente.info.nationalityPatient; // Nacionalidad del paciente
  document.getElementById("placeBirthPatient").value =
    paciente.info.placeBirthPatient; // Lugar de nacimiento del paciente
  document.getElementById("placeOriginPatient").value =
    paciente.info.placeOriginPatient; // Lugar de procedencia del paciente
  document.getElementById("addressPatient").value =
    paciente.info.addressPatient; // Residencia actual del paciente
  document.getElementById("phonePatient").value = paciente.info.phonePatient; // Teléfono del paciente
  // Antecedentes Médicos y Familiares
  document.getElementById("medicalHistory").value =
    paciente.info.medicalHistory; // Antecedentes médicos
  document.getElementById("familyHistory").value = paciente.info.familyHistory; // Antecedentes familiares
  // Observaciones
  document.getElementById("observations").value = paciente.info.observations; // Observaciones adicionales
  // Diagnóstico preliminar
  document.getElementById("diagnosis").value = paciente.info.diagnosis; // Diagnóstico preliminar
  // Plan de tratamiento
  document.getElementById("treatment").value = paciente.info.treatment; // Plan de tratamiento
  // Recomendaciones
  document.getElementById("recommendations").value =
    paciente.info.recommendations; // Recomendaciones adicionales
  // Seguimiento
  document.getElementById("followUp").value = paciente.info.followUp; // Plan de seguimiento
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
    ShowSpeakerLabel: true, // Habilita la diarización
    MaxSpeakerLabels: 2, // Número máximo de personas que pueden hablar (ajústalo según tu caso)
  });
  const data = await transcribeClient.send(command);
  for await (const event of data.TranscriptResultStream) {
    const results = event.TranscriptEvent.Transcript.Results;
    if (results.length && !results[0]?.IsPartial) {
      const transcript = results[0].Alternatives[0].Transcript;
      const speaker = results[0].Alternatives[0].Items[0].Speaker;
      //console.log(JSON.stringify(results[0], null, 2));
      console.log(`Speaker ${speaker}: ${transcript}`);
      callback(`Speaker ${speaker}: ${transcript} `);
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

async function formatearHistoriaClinica(transcript) {
  console.log(transcript);
  const prompt = `
Eres un médico encargado de analizar y convertir conversaciones en historias clínicas detalladas y bien estructuradas. A continuación, se presenta una conversación entre un médico y un paciente. Convierte esta conversación en una historia clínica detallada en formato JSON, siguiendo el esquema proporcionado. Cada campo debe completarse con base en la información extraída de la conversación.

Recuerda:
1. Usa texto completo y bien estructurado en cada campo.
2. Si no se menciona alguna información, deja el campo en blanco ("").
3. Los antecedentes médicos y familiares deben presentarse de manera ordenada y clara.
4. Sigue el formato JSON y estructura indicados.

Conversación:
"${transcript}"

FORMATO DE LA INFORMACIÓN QUE NECESITO (Devuelve **únicamente** el siguiente JSON):

{
  "info": {
    "namePatient": "",       // Nombre del paciente
    "agePatient": "",        // Edad del paciente
    "dateConsultation": "",  // Fecha de la consulta
    "numberHc": "",          // Número de Historia Clínica (dejar en blanco si no lo menciona)
    "reasonConsultation": "", // Motivo de la consulta (descripción basada en la conversación)
    "datePatient": "",       // Fecha de nacimiento del paciente (dejar en blanco si no lo menciona)
    "sexPatient": "",        // Sexo del paciente (dejar en blanco si no lo menciona)
    "statusMaritalPatient": "", // Estado civil del paciente (dejar en blanco si no lo menciona)
    "nationalityPatient": "",   // Nacionalidad del paciente (dejar en blanco si no lo menciona)
    "placeBirthPatient": "",    // Lugar de nacimiento del paciente (dejar en blanco si no lo menciona)
    "placeOriginPatient": "",   // Lugar de procedencia del paciente (dejar en blanco si no lo menciona)
    "addressPatient": "",       // Residencia actual del paciente (dejar en blanco si no lo menciona)
    "phonePatient": "",         // Teléfono del paciente (dejar en blanco si no lo menciona)
    "medicalHistory": "",    // Antecedentes médicos del paciente
    "familyHistory": "",     // Antecedentes familiares del paciente (colocar "NINGUNO" si no tiene)
    "observations": "",      // Observaciones adicionales sobre el estado del paciente
    "diagnosis": "",         // Diagnóstico basado en la información proporcionada
    "treatment": "",         // Plan de tratamiento recomendado
    "recommendations": "",   // Recomendaciones adicionales para el paciente
    "followUp": "",           // Plan de seguimiento si es necesario
  }
}

`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
    });
    console.log(response.choices[0].message.content);
    return response.choices[0].message.content;
  } catch (error) {
    console.error(error);
  }
}

// Historia Clínica:
//   Paciente: (namePatient)[Nombre del paciente]
//   Edad: (agePatient)[Edad del paciente]
//   Fecha de consulta: (dateConsultation)[Fecha de la consulta]
//   Nro Historia Clínica: (numberHc)[Nro de historia clínica, dejalo en blanco si no lo indica]

//   Motivo de consulta:
//   (reasonConsultation)[Describir el motivo de la consulta basado en la conversación]

//   Datos Personales:
//   Nombre Completo: (namePatient)[Nombre Completo del Paciente]
//   Fecha de Nacimiento: (datePatient)[Fecha de nacimiento del Paciente - dejar en blanco si no lo indica]
//   Sexo:  (sexPatient)[Ejm: Masculino - dejar en blanco si no lo indica]
//   Estado Civil: (statusMaritalPatient)[Ejm: Viudo - dejar en blanco si no lo indica]
//   Nacionalidad: (nationalityPatient)[Ejm: Peruana - dejar en blanco si no lo indica]
//   Lugar de Nacimiento: (placeBirthPatient)[Ejm: Puno, provincia de Azángaro  - dejar en blanco si no lo indica]
//   Lugar de Procedencia: (placeOriginPatient)[Ejm: Pocla Pasta, Carabaya, Arequipa  - dejar en blanco si no lo indica]
//   Residencia Actual: (addressPatient)[Ejm:  Uno de los jóvenes, Israel  - dejar en blanco si no lo indica]
//   Teléfono: (phonePatient)[Número de Teléfono - dejar en blanco si no lo indic]

//   Antecedentes Médicos:
//   (medicalHistory)[Detallar de ma manera ordenada y organizada los antecedentes médicos]

//   Antecedentes Familiares:
//   (familyHistory)[Detallar de ma manera ordenada y organizada los antecedentes médicos familiares, si no  tiene colocar "NINGUNO"]

//   Interrogatorio:
//   (interrogation)[Preguntas y respuestas relevantes extraídas de la conversación]

//   Observaciones:
//   (observations)[Observaciones adicionales sobre el estado del paciente]

//   Diagnóstico preliminar:
//   (diagnosis)[Diagnóstico basado en la información proporcionada]

//   Plan de tratamiento:
//   (treatment)[Descripción del tratamiento recomendado]

//   Recomendaciones:
//   (recommendations)[Cualquier recomendación adicional para el paciente]

//   Seguimiento:
//   (followUp)[Plan de seguimiento si es necesario]
