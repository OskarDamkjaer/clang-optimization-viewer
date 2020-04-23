#include <stdarg.h>

int demo(int *a)
{
  int sum = 0;

  for (int i = 1; i < 1000; i++)
  {
    if (a[i] > 2)
    {
      sum += a[i];
    }
    else
    {
       sum += demo(a);
    }
  }
  return sum;
}
