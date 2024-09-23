const AWS = require("aws-sdk");

module.exports = class AWSS3Service {
  constructor(region, accesskey, secretkey) {
    this.region = region;
    this.accesskey = accesskey;
    this.secretkey = secretkey;
  }
  getS3Client() {
    return new AWS.S3({
      region: this.region,
      apiVersion: "latest",
      credentials: {
        accessKeyId: this.accesskey,
        secretAccessKey: this.secretkey,
      },
    });
  }

  createS3Bucket() {
    let s3Client = this.getS3Client();
    s3Client.createBucket(
      {
        Bucket: "sms-bucket-from-node", //Your bucket name
      },
      (error, success) => {
        if (error) console.log(error);
        console.log(success);
      }
    );
  }

  uploadObject(req, res) {
    const { originalname, buffer } = req.file;
    console.log(buffer);
    let s3Client = this.getS3Client();
    s3Client.putObject(
      {
        Bucket: "ycvilllegasbk",
        Key: originalname,
        Body: buffer,
      },
      (error, success) => {
        if (error) console.log(error);
        console.log(success);
      }
    );
  }

  async ploadObject(req, res) {
    const file = req.file;

    const params = {
      Bucket: ycvilllegasbk,
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
  }

  deleteObject() {
    let s3Client = this.getS3Client();
    s3Client.deleteObject(
      {
        Bucket: "sms-bucket-from-node",
        Key: "mt-txt-file.txt",
      },
      (error, success) => {
        if (error) console.log(error);
        console.log(success);
      }
    );
  }
};
