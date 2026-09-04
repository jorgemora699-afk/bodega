UMBRAL_BAJO_STOCK_DEFAULT = 5


def esta_bajo_stock(stock_actual, umbral=UMBRAL_BAJO_STOCK_DEFAULT):
    return stock_actual <= umbral


def hay_stock_suficiente(stock_actual, cantidad_a_restar):
    return stock_actual >= cantidad_a_restar