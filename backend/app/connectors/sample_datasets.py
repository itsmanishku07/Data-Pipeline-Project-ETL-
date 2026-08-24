import random
from datetime import datetime, timedelta
import pandas as pd

def generate_ecommerce_orders() -> pd.DataFrame:
    random.seed(42)
    categories = ["Electronics", "Apparel", "Home & Kitchen", "Books", "Beauty", "Sports"]
    products = {
        "Electronics": ["Pro Laptop 15", "Wireless Earbuds", "Ultra HD Monitor", "Smart Watch 4", "USB-C Hub"],
        "Apparel": ["Classic Denim Jacket", "Running Shoes", "Cotton Crewneck", "Wool Scarf", "Activewear Leggings"],
        "Home & Kitchen": ["Espresso Maker", "Air Fryer 5L", "Blender Pro", "Chef Knife Set", "Stainless Pan"],
        "Books": ["Data Engineering with Spark", "Cloud Architecture", "Clean Code", "Designing Data Systems", "Python Deep Dive"],
        "Beauty": ["Hydrating Serum", "Mineral Sunscreen", "Botanical Shampoo", "Facial Cleanser", "Eye Cream"],
        "Sports": ["Yoga Mat Non-Slip", "Adjustable Dumbbells", "Cycling Helmet", "Hydration Flask", "Resistance Bands"]
    }
    statuses = ["COMPLETED", "PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED"]
    payment_methods = ["CREDIT_CARD", "PAYPAL", "APPLE_PAY", "WIRE_TRANSFER", "CRYPTO"]
    countries = ["USA", "Canada", "Germany", "United Kingdom", "Japan", "Australia", "India", "France"]

    rows = []
    base_date = datetime(2024, 1, 1)
    for i in range(1, 1501):
        cat = random.choice(categories)
        prod = random.choice(products[cat])
        qty = random.randint(1, 8)
        unit_price = round(random.uniform(12.5, 899.0), 2)
        discount = round(random.choice([0.0, 0.05, 0.10, 0.15, 0.20, 0.25]), 2)
        days_offset = random.randint(0, 240)
        order_dt = base_date + timedelta(days=days_offset, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        
        raw_phone = f"+1-555-{random.randint(100,999)}-{random.randint(1000,9999)}" if random.random() > 0.15 else None
        country_val = random.choice(countries) if random.random() > 0.05 else None
        
        rows.append({
            "order_id": f"ORD-{10000 + i}",
            "customer_id": f"CUST-{random.randint(100, 400)}",
            "product_name": prod,
            "category": cat,
            "quantity": str(qty),
            "unit_price": str(unit_price),
            "discount_pct": discount,
            "order_timestamp": order_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "status": random.choice(statuses),
            "payment_method": random.choice(payment_methods),
            "customer_country": country_val,
            "customer_phone": raw_phone
        })
    return pd.DataFrame(rows)

def generate_customer_profiles() -> pd.DataFrame:
    random.seed(101)
    first_names = ["Emma", "Liam", "Olivia", "Noah", "Sophia", "Jackson", "Ava", "Lucas", "Mia", "Ethan", "Isabella", "Aiden"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
    cust_rows = []
    for cid in range(100, 401):
        fn = random.choice(first_names)
        ln = random.choice(last_names)
        age = random.randint(18, 72)
        spend = round(random.uniform(50.0, 15000.0), 2)
        tier = "PLATINUM" if spend > 8000 else ("GOLD" if spend > 3000 else ("SILVER" if spend > 1000 else "STANDARD"))
        signup = datetime(2022, 1, 1) + timedelta(days=random.randint(0, 800))
        cust_rows.append({
            "customer_id": f"CUST-{cid}",
            "full_name": f"{fn} {ln}",
            "email": f"{fn.lower()}.{ln.lower()}{cid}@example.com",
            "age": age,
            "signup_date": signup.strftime("%Y-%m-%d"),
            "loyalty_tier": tier,
            "lifetime_spend": spend,
            "credit_score": random.randint(580, 850),
            "is_active": "true" if random.random() > 0.1 else "false"
        })
    return pd.DataFrame(cust_rows)

def generate_iot_telemetry() -> pd.DataFrame:
    random.seed(777)
    devices = [f"SENSOR-NODE-{i:03d}" for i in range(1, 21)]
    iot_rows = []
    start_time = datetime(2024, 6, 1, 0, 0, 0)
    for i in range(2000):
        d = random.choice(devices)
        ts = start_time + timedelta(minutes=i * 5)
        temp = round(random.normalvariate(24.5, 3.2), 2)
        humidity = round(random.uniform(35.0, 75.0), 2)
        vibration = round(random.uniform(0.01, 1.45), 3)
        pressure = round(random.normalvariate(1013.25, 5.0), 2)
        battery = max(0, round(100.0 - (i * 0.03) + random.uniform(-1, 1), 1))
        status = "WARNING" if temp > 30.0 or vibration > 1.2 else "NORMAL"
        iot_rows.append({
            "device_id": d,
            "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
            "temperature_c": temp,
            "humidity_pct": humidity,
            "vibration_g": vibration,
            "pressure_hpa": pressure,
            "battery_level_pct": battery,
            "device_status": status
        })
    return pd.DataFrame(iot_rows)

def ensure_sample_datasets():
    # In-memory generator - zero disk storage files created
    pass
