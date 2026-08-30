package publisher

import (
	"context"
	"github.com/redis/go-redis/v9"
)

type Publisher interface {
	Publish(ctx context.Context, channel, message string) error
	Close() error
}

type RedisPublisher struct {
	client *redis.Client
}

func NewRedisPublisher(redisURL string) (*RedisPublisher, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opts)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}
	return &RedisPublisher{client: client}, nil
}

func (p *RedisPublisher) Publish(ctx context.Context, channel, message string) error {
	return p.client.Publish(ctx, channel, message).Err()
}

func (p *RedisPublisher) Close() error {
	return p.client.Close()
}
