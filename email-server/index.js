import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import nodemailer from 'nodemailer'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

app.post('/api/v1/email-templates/send-test', async (req, res) => {
  const { recipientEmail, subject, htmlContent } = req.body

  if (!recipientEmail || !htmlContent) {
    return res.status(400).json({ error: 'recipientEmail and htmlContent are required' })
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: recipientEmail,
      subject: subject ?? 'Test Email from Migration Hub',
      html: htmlContent,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('Send failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`Email server running on http://localhost:${PORT}`)
})
