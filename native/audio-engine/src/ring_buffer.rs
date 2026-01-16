//! Ring buffer types and utilities
//!
//! This module provides type aliases and utilities for thread-safe ring buffers
//! used for audio data transfer between threads.

use ringbuf::HeapRb;
use std::sync::{Arc, Mutex};

/// Type alias for ring buffer producer wrapped in Arc<Mutex<...>>
pub type RingBufferProducer = Arc<Mutex<ringbuf::Producer<i16, Arc<HeapRb<i16>>>>>;

/// Type alias for ring buffer consumer wrapped in Arc<Mutex<...>>
pub type RingBufferConsumer = Arc<Mutex<ringbuf::Consumer<i16, Arc<HeapRb<i16>>>>>;

/// Create a new ring buffer and return producer/consumer pair
pub fn create_ring_buffer(size: usize) -> (RingBufferProducer, RingBufferConsumer) {
    let ring = HeapRb::<i16>::new(size);
    let (producer, consumer) = ring.split();
    (
        Arc::new(Mutex::new(producer)),
        Arc::new(Mutex::new(consumer)),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_ring_buffer() {
        let (producer, consumer) = create_ring_buffer(100);
        assert!(producer.lock().is_ok());
        assert!(consumer.lock().is_ok());
    }

    #[test]
    fn test_ring_buffer_push_pop() {
        let (producer, consumer) = create_ring_buffer(10);

        // Push samples
        {
            let mut prod = producer.lock().unwrap();
            let samples = vec![1000i16, 2000, 3000];
            let pushed = prod.push_slice(&samples);
            assert_eq!(pushed, 3);
        }

        // Pop samples
        {
            let mut cons = consumer.lock().unwrap();
            let mut buffer = vec![0i16; 10];
            let popped = cons.pop_slice(&mut buffer);
            assert_eq!(popped, 3);
            assert_eq!(&buffer[..3], &[1000, 2000, 3000]);
        }
    }

    #[test]
    fn test_ring_buffer_overflow() {
        let (producer, consumer) = create_ring_buffer(5);

        // Push more than capacity
        {
            let mut prod = producer.lock().unwrap();
            let samples = vec![1000i16, 2000, 3000, 4000, 5000, 6000, 7000];
            let pushed = prod.push_slice(&samples);
            // Should only push up to capacity
            assert_eq!(pushed, 5);
        }

        // Pop all
        {
            let mut cons = consumer.lock().unwrap();
            let mut buffer = vec![0i16; 10];
            let popped = cons.pop_slice(&mut buffer);
            assert_eq!(popped, 5);
        }
    }

    #[test]
    fn test_ring_buffer_empty() {
        let (_producer, consumer) = create_ring_buffer(10);

        // Try to pop from empty buffer
        {
            let mut cons = consumer.lock().unwrap();
            let mut buffer = vec![0i16; 10];
            let popped = cons.pop_slice(&mut buffer);
            assert_eq!(popped, 0);
        }
    }

    #[test]
    fn test_ring_buffer_len() {
        let (producer, consumer) = create_ring_buffer(10);

        // Initially empty
        {
            let cons = consumer.lock().unwrap();
            assert_eq!(cons.len(), 0);
        }

        // Push some samples
        {
            let mut prod = producer.lock().unwrap();
            let samples = vec![1000i16, 2000, 3000];
            prod.push_slice(&samples);
        }

        // Check length
        {
            let cons = consumer.lock().unwrap();
            assert_eq!(cons.len(), 3);
        }
    }
}
