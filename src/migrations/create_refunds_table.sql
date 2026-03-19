-- Migration: Create refunds table
-- Run this SQL in your PostgreSQL database

CREATE TABLE IF NOT EXISTS refunds (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),

    -- Refund details
    refund_number VARCHAR(30) NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    refund_amount DECIMAL(12, 2) NOT NULL,

    -- Customer's e-wallet phone for refund
    ewallet_phone VARCHAR(20) NOT NULL,

    -- Status workflow: pending -> approved/rejected -> completed
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),

    -- Admin response
    admin_notes TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Transfer proof (optional - admin uploads)
    transfer_proof_url VARCHAR(500),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at DESC);
