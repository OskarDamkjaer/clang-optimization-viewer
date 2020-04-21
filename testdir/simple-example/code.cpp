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
      return 0;
    }
  }
  return sum;
}
