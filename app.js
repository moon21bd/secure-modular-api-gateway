const createError = require("http-errors")
const express = require("express")
const path = require("path")
const cookieParser = require("cookie-parser")
const logger = require("morgan")
const bodyParser = require("body-parser")
const cors = require("cors")

const authRouter = require("./routes/auth")
const configRouter = require("./routes/configuration")
const currencyRouter = require("./routes/currency")
const fileUploadRouter = require("./routes/file.upload")
const fileDownloadRouter = require("./routes/file.download")
const fundTransferRouter = require("./routes/fund_transfer")
const lotRouter = require("./routes/lot")
const productRouter = require("./routes/product")
const roleRouter = require("./routes/role")
const userRouter = require("./routes/user")
const userRoutesRouter = require("./routes/user.routes")
const promoRouter = require("./routes/promo")
const resourceRouter = require("./routes/resource")
const walletRouter = require("./routes/wallet")
const sendNotification = require("./routes/notification")
const complainHandlerRouter = require("./routes/complain")
const bankReceiptRouter = require("./routes/bank-receipt")

const tokenhandler = require("./lib/tokenhandler")
const resGen = require("./lib/result.codes")
const validator = require("./lib/validator")
const startPolling = require("./lib/event.emitter")
const util = require("./lib/utils")
const ipFilter = require("./lib/ip.filter")

const cfg = require("./config")

const interceptor = require("express-interceptor")
const activitylogMiddleware = require("./lib/activitylogMiddleware")

const app = express()

const appNotifications = require("./components/inapp-notification")

// Background sweep for expired temp files. Self-rescheduling rather than a
// fixed interval, so a slow sweep can never overlap with the next one.
startPolling(cfg.ttl.tmpfile, () => {
    util.deleteFilesFromDirectory("tmp/", cfg.ttl.tmpfile)
})

app.set("views", path.join(__dirname, "views"))
app.set("view engine", "pug")

cfg.env === "production" || app.use(logger("combined", { stream: cfg.logger.stream }))

app.use(
    cors({
        origin: "*",
        methods: "POST,OPTIONS",
        allowedHeaders: ["Content-Type", "Authorization"],
        optionsSuccessStatus: 200
    })
)
app.disable("x-powered-by")

// This route must be registered BEFORE bodyParser.text({ type: "*/*" }) below,
// otherwise multer never sees the raw multipart stream and every
// multipart/form-data upload fails with a Bad Request.
app.use("/api", bankReceiptRouter)

app.use("/api", tokenhandler.verifyAccessToken, fileUploadRouter)
app.use("/api", tokenhandler.verifyAccessToken, complainHandlerRouter)
app.use("/api", fileDownloadRouter)

app.use(express.static(path.join(__dirname, "public")))

// Bodies arrive as encrypted text rather than JSON (see lib/tokenhandler.js),
// so they are read as raw text here and decrypted/parsed further down the
// chain instead of being handed straight to a JSON parser.
app.use(bodyParser.text({ type: "*/*" }))

app.use(function (req, res, next) {
    try {
        req.body = JSON.parse(req.body)
        next()
    } catch (e) {
        // A query-string-only request has no body to parse and is still valid.
        if (req.query && Object.keys(req.query).length !== 0) {
            next()
        } else {
            next(createError(400))
        }
    }
})

// Appends the caller's unread in-app notification count onto responses for
// endpoints the client polls anyway. Done as an interceptor so no individual
// component has to know about notifications, and so adding it to another
// endpoint is one entry in the list below rather than a code change.
const responseInterceptor = interceptor(function (req, res) {
    return {
        isInterceptable: function () {
            return req.body.userId
        },

        intercept: function (body, send) {
            const parsedResponse = JSON.parse(body)
            appNotifications.getNotificationCount(req.body.userId, parsedResponse, send)
        }
    }
})

app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use("/auth", authRouter)

// Login endpoints are activity-logged before authentication, because a failed
// login is exactly the event worth recording.
app.use("/api/login", activitylogMiddleware.activityLog)
app.use("/api/admin/login", activitylogMiddleware.activityLog)

app.use(["/api/get-specific-user-info", "/api/user/balance-check"], responseInterceptor)

// The single authenticated API surface. Order matters: IP filter, then token
// verification, then payload decryption, then schema validation -- each stage
// assumes the previous one has already run.
app.use(
    "/api",
    ipFilter,
    tokenhandler.verifyAccessToken,
    tokenhandler.retrievePayload,
    validator,
    currencyRouter,
    fileUploadRouter,
    fundTransferRouter,
    lotRouter,
    productRouter,
    roleRouter,
    userRouter,
    userRoutesRouter,
    configRouter,
    promoRouter,
    resourceRouter,
    walletRouter,
    sendNotification
)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404))
})

// error handler
app.use(function (err, req, res, next) {
    let responseType = resGen.INTERNAL_SERVER_ERROR
    if (err.status >= 400 && err.status < 500) {
        responseType = resGen.INVALID_PARAMS_ERR
    }
    res.status(err.status)
    res.json(resGen.responseGenerator(responseType, err.message, undefined, err.status))
})

module.exports = app
