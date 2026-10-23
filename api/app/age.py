from datetime import date

ADULT = 18
MIN_AGE = 17  # 17-year-olds need a guardian's consent


def age_on(birth: date, today: date) -> int:
    had_birthday = (today.month, today.day) >= (birth.month, birth.day)
    return today.year - birth.year - (0 if had_birthday else 1)
