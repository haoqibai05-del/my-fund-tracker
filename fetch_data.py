import yfinance as yf
import json
from datetime import datetime
import pytz

# 封装一个抓取点位和涨跌幅的函数，方便复用
def get_change(ticker_symbol):
    ticker = yf.Ticker(ticker_symbol)
    # 获取最近2天的数据
    hist = ticker.history(period="2d")
    if len(hist) < 2:
        return 0.0, 0.0
    
    close_today = hist['Close'].iloc[-1]
    close_yesterday = hist['Close'].iloc[-2]
    # 计算涨跌幅百分比
    change_percent = ((close_today - close_yesterday) / close_yesterday) * 100
    
    return round(close_today, 2), round(change_percent, 2)

try:
    print("⏳ 正在向 Yahoo Finance 请求数据，请稍候...")
    
    # 1. 获取纳斯达克 100 (^NDX)
    ndx_points, ndx_change = get_change("^NDX")
    
    # 2. 获取标普 500 等权重 (^SPXEW)
    spxew_points, spxew_change = get_change("^SPXEW")
    
    # 3. 获取美元/人民币汇率 (CNY=X)
    cny_points, cny_change = get_change("CNY=X")

    # 获取当前北京时间
    tz = pytz.timezone('Asia/Shanghai')
    update_time = datetime.now(tz).strftime('%Y-%m-%d %H:%M:%S')

    # 组装要写入 JSON 的数据
    data = {
        "updateTime": update_time,
        "nasdaq100": {
            "name": "纳斯达克 100",
            "points": ndx_points,
            "changePercent": ndx_change
        },
        "sp500ew": {
            "name": "标普 500 等权重",
            "points": spxew_points,
            "changePercent": spxew_change
        },
        "exchangeRate": {
            "name": "USD/CNY 汇率",
            "points": cny_points,
            "changePercent": cny_change
        }
    }

    # 写入 JSON 文件
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print("✅ 数据抓取成功！已在当前目录生成 data.json 文件。")

except Exception as e:
    print(f"❌ 抓取失败: {e}")