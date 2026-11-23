FROM golang:1.27-alpine3.24 AS builder

WORKDIR /src
RUN apk add --no-cache build-base git tzdata

COPY go.mod ./
RUN go mod download

COPY . .
RUN go mod tidy \
  && CGO_ENABLED=1 GOOS=linux go build -o /out/apimain ./cmd/apimain.go \
  && mkdir -p /out/data /out/runtime \
  && cp -a resources docs conf /out/

FROM alpine:3.24

WORKDIR /app
RUN apk upgrade --no-cache \
  && apk add --no-cache ca-certificates tzdata \
  && apk list -I musl

COPY --from=builder /out/ /app/

VOLUME /app/data

EXPOSE 21114

CMD ["./apimain"]
