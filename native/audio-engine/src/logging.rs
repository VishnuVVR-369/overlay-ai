//! Centralized logging utilities
//!
//! This module provides utilities for consistent debug logging throughout the application.

use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

/// Debug logger for tracking and controlling debug output
pub struct DebugLogger {
    enabled: bool,
    counters: Mutex<HashMap<String, AtomicUsize>>,
}

impl DebugLogger {
    /// Create a new debug logger
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled,
            counters: Mutex::new(HashMap::new()),
        }
    }

    /// Check if we should log based on call count and interval
    /// This method increments the counter for the given key each time it's called.
    pub fn should_log(&self, key: &str, initial_count: usize, interval: usize) -> bool {
        if !self.enabled {
            return false;
        }

        let mut counters = self.counters.lock().unwrap();
        let counter = counters
            .entry(key.to_string())
            .or_insert_with(|| AtomicUsize::new(0));
        let count = counter.fetch_add(1, Ordering::Relaxed);

        count < initial_count || count.is_multiple_of(interval)
    }

    /// Increment counter for a given key
    #[allow(dead_code)] // Used in tests and may be used by future code
    pub fn increment(&self, key: &str) -> usize {
        let mut counters = self.counters.lock().unwrap();
        let counter = counters
            .entry(key.to_string())
            .or_insert_with(|| AtomicUsize::new(0));
        counter.fetch_add(1, Ordering::Relaxed)
    }

    /// Get current count for a key
    #[allow(dead_code)] // Used in tests and may be used by future code
    pub fn get_count(&self, key: &str) -> usize {
        let counters = self.counters.lock().unwrap();
        counters
            .get(key)
            .map(|c| c.load(Ordering::Relaxed))
            .unwrap_or(0)
    }
}

impl Default for DebugLogger {
    fn default() -> Self {
        Self::new(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_debug_logger_disabled() {
        let logger = DebugLogger::new(false);
        assert!(!logger.should_log("test", 5, 100));
    }

    #[test]
    fn test_debug_logger_initial_count() {
        let logger = DebugLogger::new(true);

        // First few calls should log (should_log increments automatically)
        for _ in 0..5 {
            assert!(logger.should_log("test", 5, 100));
        }
    }

    #[test]
    fn test_debug_logger_interval() {
        let logger = DebugLogger::new(true);

        // First 5 calls should log (counts 0-4 before increment)
        for i in 0..5 {
            assert!(
                logger.should_log("test", 5, 100),
                "Should log at call {}",
                i + 1
            );
        }

        // Next calls up to 100 should not log (counts 5-99 before increment)
        for i in 5..100 {
            assert!(
                !logger.should_log("test", 5, 100),
                "Should not log at call {}",
                i + 1
            );
        }

        // Call 101: checks count 100 (before increment), which is a multiple of 100, should log
        assert!(logger.should_log("test", 5, 100));

        // Next calls up to 200 should not log (counts 101-199 before increment)
        for i in 0..98 {
            assert!(
                !logger.should_log("test", 5, 100),
                "Should not log at call {}",
                102 + i
            );
        }

        // Call 200: checks count 199 (before increment), should not log
        assert!(!logger.should_log("test", 5, 100));

        // Call 201: checks count 200 (before increment), which is a multiple of 100, should log
        assert!(logger.should_log("test", 5, 100));
    }

    #[test]
    fn test_debug_logger_get_count() {
        let logger = DebugLogger::new(true);

        assert_eq!(logger.get_count("test"), 0);

        logger.increment("test");
        assert_eq!(logger.get_count("test"), 1);

        logger.increment("test");
        assert_eq!(logger.get_count("test"), 2);
    }

    #[test]
    fn test_debug_logger_multiple_keys() {
        let logger = DebugLogger::new(true);

        logger.increment("key1");
        logger.increment("key2");
        logger.increment("key1");

        assert_eq!(logger.get_count("key1"), 2);
        assert_eq!(logger.get_count("key2"), 1);
    }
}
