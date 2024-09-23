const express = require("express");
const multer = require("multer");
const fs = require("fs");
const aws = require("aws-sdk");
const cors = require("cors");

const s3Service = require("./aws");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const aws_region = process.env.AWS_REGION;
const aws_id = process.env.AWS_ID;
const aws_secretkey = process.env.AWS_SECRETKEY;
let s3Client = new s3Service(aws_region, aws_id, aws_secretkey);
const AWS = require("aws-sdk");
const s3 = new AWS.S3({
  accessKeyId: aws_id,
  secretAccessKey: aws_secretkey,
});

aws_secretkey;
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "upload/"); // Guardar archivos localmente en la carpeta 'upload'
//   },
//   filename: (req, file, cb) => {
//     cb(null, file.originalname);
//   },
// });
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Configuración de AWS Transcribe
const transcribeService = new aws.TranscribeService({
  region: aws_region, // Cambia la región según tu configuración
  accessKeyId: aws_id,
  secretAccessKey: aws_secretkey,
});
app.get("/", (req, res) => {
  res.send("Servidor funcionando");
});

app.post("/upload3", upload.single("audioFile"), async (req, res) => {
  const file = req.file;
  const params = {
    Bucket: "ycvilllegasbk",
    Key: file.originalname,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    await s3.upload(params).promise();
    res.status(200).send("File uploaded to S3 successfully!");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error uploading file to S3");
  }
});

app.post("/upload", upload.single("audioFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ error: "No file uploaded." });
    }
    s3Client.uploadObject(req);
    const transcriptFileUri = await checkTranscriptionJob("Prueba2");

    if (transcriptFileUri) {
      const transcription = await getTranscription(transcriptFileUri);
      console.log("Transcription:", transcription);
    }
    // transcribeService.startTranscriptionJob(params, (err, data) => {
    //   if (err) {
    //     console.error("Error en Transcribe:", err);
    //     return res
    //       .status(500)
    //       .json({ message: "Error en la transcripción", error: err });
    //   }
    //   return res.status(200).json(data);
    // });
  } catch (error) {
    console.error("Error en el servidor:", error);
    return res.status(500).json({ message: "Error procesando archivo", error });
  }
});
// Ruta para recibir el archivo de audio
app.post("/uploadv2", upload.single("audioFile"), async (req, res) => {
  try {
    const audioFilePath = `./upload/${req.file.originalname}`;

    // Verificar si el archivo existe
    if (!fs.existsSync(audioFilePath)) {
      return res
        .status(400)
        .json({ message: "El archivo no fue subido correctamente" });
    }

    // Parámetros para AWS Transcribe (o cualquier otra lógica)
    const params = {
      TranscriptionJobName: `job-${Date.now()}`,
      LanguageCode: "en-US",
      MediaFormat: "mp3",
      Media: {
        MediaFileUri: `file://${audioFilePath}`,
      },
    };

    transcribeService.startTranscriptionJob(params, (err, data) => {
      if (err) {
        console.error("Error en Transcribe:", err);
        return res
          .status(500)
          .json({ message: "Error en la transcripción", error: err });
      }

      // Elimina el archivo después de la transcripción
      fs.unlink(audioFilePath, (err) => {
        if (err) {
          console.error("Error al eliminar el archivo:", err);
        }
      });

      return res.status(200).json({ message: "Transcripción iniciada", data });
    });
  } catch (error) {
    console.error("Error en el servidor:", error);
    return res.status(500).json({ message: "Error en el servidor", error });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const createTranscriptionJob = async () => {
  const params = {
    TranscriptionJobName: "Prueba2",
    LanguageCode: "es-ES", // Cambia según el idioma
    Media: {
      MediaFileUri: `s3://ycvilllegasbk/audio.mp3`,
    },
    MediaFormat: "mp3",
  };

  try {
    const data = await transcribeService
      .startTranscriptionJob(params)
      .promise();
    console.log("Transcription job started:", data);
  } catch (error) {
    console.error("Error starting transcription job:", error);
  }
};

const checkTranscriptionJob = async (jobName) => {
  const params = {
    TranscriptionJobName: jobName,
  };

  try {
    const data = await transcribeService.getTranscriptionJob(params).promise();
    const jobStatus = data.TranscriptionJob.TranscriptionJobStatus;

    console.log("Transcription job status:", jobStatus);

    // Si el trabajo está completo, obtiene la transcripción
    if (jobStatus === "COMPLETED") {
      const transcriptFileUri =
        data.TranscriptionJob.Transcript.TranscriptFileUri;
      console.log("Transcription file available at:", transcriptFileUri);
      return transcriptFileUri; // Retorna la URI del archivo de transcripción
    } else if (jobStatus === "FAILED") {
      console.error("Transcription job failed.");
      return null;
    }

    // Si aún no está completo, espera un momento y vuelve a verificar
    console.log("Waiting for job to complete...");
    setTimeout(() => checkTranscriptionJob("Prueba2"), 5000); // Revisa cada 5 segundos
  } catch (error) {
    console.error("Error getting transcription job status:", error);
  }
};

// Función para obtener la transcripción
const getTranscription = async (transcriptFileUri) => {
  const response = await fetch(transcriptFileUri);
  const transcriptData = await response.json();
  const transcript = transcriptData.results.transcripts[0].transcript;

  return transcript;
};
