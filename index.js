const express = require('express')
const jwt = require('jsonwebtoken')
const cors = require('cors')
const axios = require('axios')
const multer = require('multer')
const fs = require('fs-extra')
const path = require('path')
const pdfParse = require('pdf-parse')
const mammoth = require('mammoth')
const XLSX = require('xlsx')
const schedule = require('node-schedule')

require('dotenv').config()

const app = express()
const secretKey = process.env.JWT_SECRET_KEY
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(cors())

// 辅助函数：将 CSV 字符串转换为 Markdown 表格
function csvToMarkdown(csv) {
  const lines = csv.trim().split('\n')
  if (lines.length === 0) return ''
  const headers = lines[0].split(',').map(cell => cell.trim())
  let markdown = '| ' + headers.join(' | ') + ' |\n'
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n'
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(cell => cell.trim())
    markdown += '| ' + cells.join(' | ') + ' |\n'
  }
  return markdown
}

app.post('/api/login', (req, res) => {
  const { mobile, password } = req.body
  const UsersMP = [
    { mobile: '13300000000', password: '123456' },
    { mobile: '13311111111', password: '654321' }
  ]
  const user = UsersMP.find(t => t.mobile === mobile && t.password === password)
  if (user) {
    const token = jwt.sign(
      { mobile, nickname: mobile.slice(-4) },
      secretKey,
      { expiresIn: '7d' }
    )
    res.json({
      code: 0,
      data: {
        token,
        userInfo: { mobile, nickname: mobile.slice(-4) }
      }
    })
  } else {
    res.status(401).json({ code: 401, message: '手机号或密码错误' })
  }
})

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  if (!token) {
    return res.status(401).json({ code: 401, message: '未提供 token' })
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.status(401).json({ code: 401, message: 'token 无效或已过期' })
    }
    req.user = user
    next()
  })
}

const uploadDir = path.join(__dirname, 'uploads')
fs.ensureDirSync(uploadDir)

schedule.scheduleJob('0 2 * * *', async () => {
  try {
    const files = await fs.readdir(uploadDir)
    const now = Date.now()
    for (const file of files) {
      const filePath = path.join(uploadDir, file)
      const stat = await fs.stat(filePath)
      if (now - stat.mtimeMs > 24 * 60 * 60 * 1000) {
        await fs.remove(filePath)
        console.log(`Deleted old file: ${file}`)
      }
    }
  } catch (err) {
    console.error('定时清理文件失败:', err)
  }
})

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    let originalName = file.originalname
    if (!originalName || typeof originalName !== 'string') {
      originalName = 'unknown'
    } else {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8')
    }
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(originalName)
    const filename = ext ? uniqueSuffix + ext : uniqueSuffix
    cb(null, filename)
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('不支持的文件类型'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
})

async function parseFileContent(filePath, mimeType) {
  try {
    if (mimeType === 'text/plain') {
      return await fs.readFile(filePath, 'utf-8')
    } else if (mimeType === 'application/pdf') {
      const dataBuffer = await fs.readFile(filePath)
      const data = await pdfParse(dataBuffer)
      if (!data.text || data.text.trim() === '') {
        return '[PDF 文件无文本内容，可能是扫描件]'
      }
      return data.text
    } else if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const buffer = await fs.readFile(filePath)
      const result = await mammoth.extractRawText({ buffer })
      return result.value || '[Word 文档无文本内容]'
    } else if (mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const workbook = XLSX.readFile(filePath)
      let text = ''
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName]
        const sheetData = XLSX.utils.sheet_to_csv(sheet)
        // 将 CSV 转换为 Markdown 表格格式
        const markdownTable = csvToMarkdown(sheetData)
        text += `【工作表 ${sheetName}】\n${markdownTable}\n\n`
      })
      return text || '[Excel 文件无内容]'
    } else if (mimeType.startsWith('image/')) {
      return '[图片文件，暂未支持内容提取]'
    } else {
      return null
    }
  } catch (err) {
    console.error(`解析文件失败: ${filePath}`, err)
    return '[文件解析失败]'
  }
}

// 文件上传接口
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' })
  }

  let originalName = req.file.originalname
  if (!originalName || typeof originalName !== 'string') {
    originalName = 'unknown'
  } else {
    originalName = Buffer.from(originalName, 'latin1').toString('utf8')
  }

  const protocol = req.protocol
  const host = req.get('host')
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`
  const filePath = path.join(uploadDir, req.file.filename)

  let extractedText = null
  if (['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(req.file.mimetype)) {
    extractedText = await parseFileContent(filePath, req.file.mimetype)
  }

  res.json({
    code: 0,
    data: {
      filename: originalName,
      url: fileUrl,
      type: req.file.mimetype,
      size: req.file.size,
      extractedText: extractedText
    }
  })
})

app.use('/uploads', express.static(uploadDir))

app.post('/api/chat', authenticateToken, async (req, res) => {
  const { messages } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const response = await axios.post(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        model: 'glm-4-flash',
        messages: messages,
        stream: true
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    )

    let buffer = ''
    response.data.on('data', (chk) => {
      buffer += chk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (trimmed.startsWith('data:')) {
          const jStr = trimmed.slice(5).trim()
          if (jStr === '[DONE]') {
            res.write('data:[DONE]\n\n')
            res.end()
            return
          }
          try {
            const parsed = JSON.parse(jStr)
            const content = parsed.choices[0]?.delta?.content || ''
            if (content) {
              res.write(`data:${JSON.stringify({ content })}\n\n`)
            }
          } catch (e) { }
        }
      }
    })

    response.data.on('end', () => {
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n')
        res.end()
      }
    })

    response.data.on('error', (err) => {
      console.error('流式错误:', err)
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
        res.end()
      }
    })
  } catch (error) {
    console.error('AI 接口错误：', error.response?.data || error.message)
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI 服务出错' })
    } else {
      res.write(`data: ${JSON.stringify({ error: 'AI 服务出错' })}\n\n`)
      res.end()
    }
  }
})

app.get('/', (req, res) => {
  res.send('Backend is running')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})