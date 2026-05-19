package custom_types

import (
	"database/sql/driver"
	"strconv"
	"strings"
	"time"
)

// AutoTime 自定义时间格式
type AutoTime time.Time

func (mt AutoTime) Value() (driver.Value, error) {
	var zeroTime time.Time
	t := time.Time(mt)
	if t.UnixNano() == zeroTime.UnixNano() {
		return nil, nil
	}
	return t, nil
}

func (mt AutoTime) MarshalJSON() ([]byte, error) {
	//b := make([]byte, 0, len("2006-01-02 15:04:05")+2)
	b := time.Time(mt).AppendFormat([]byte{}, "\"2006-01-02 15:04:05\"")
	return b, nil
}

func (mt *AutoTime) UnmarshalJSON(b []byte) error {
	raw := strings.TrimSpace(string(b))
	if raw == "" || raw == "null" {
		*mt = AutoTime(time.Time{})
		return nil
	}
	raw = strings.Trim(raw, `"`)
	if raw == "" {
		*mt = AutoTime(time.Time{})
		return nil
	}
	if unix, err := strconv.ParseInt(raw, 10, 64); err == nil {
		*mt = AutoTime(time.Unix(unix, 0))
		return nil
	}
	layouts := []string{
		"2006-01-02 15:04:05",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05-07:00",
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02T15:04:05Z07:00",
		time.RFC3339,
		time.RFC3339Nano,
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, raw); err == nil {
			*mt = AutoTime(parsed)
			return nil
		}
	}
	if len(raw) >= len("2006-01-02 15:04:05") {
		if parsed, err := time.ParseInLocation("2006-01-02 15:04:05", raw[:len("2006-01-02 15:04:05")], time.Local); err == nil {
			*mt = AutoTime(parsed)
			return nil
		}
	}
	parsed, err := time.ParseInLocation("2006-01-02 15:04:05", raw, time.Local)
	if err != nil {
		return err
	}
	*mt = AutoTime(parsed)
	return nil
}
